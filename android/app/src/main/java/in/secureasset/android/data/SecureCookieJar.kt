package in.secureasset.android.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Persists only the API session and CSRF cookies, encrypted at rest. */
class SecureCookieJar(context: Context, private val apiHost: String) : CookieJar {
    private val prefs = context.applicationContext.getSharedPreferences("secureasset.cookies.v1", Context.MODE_PRIVATE)
    private val lock = Any()
    private val memory = linkedMapOf<String, Cookie>()

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        synchronized(lock) {
            cookies.forEach { cookie ->
                if (cookie.matches(url)) memory[key(cookie)] = cookie
                if (cookie.matches(url) && cookie.secure && url.host == apiHost && cookie.name in persistedNames) {
                    runCatching { prefs.edit().putString(key(cookie), seal(cookie.toString())).apply() }
                }
            }
            pruneExpired()
        }
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> = synchronized(lock) {
        hydrate(url)
        pruneExpired()
        memory.values.filter { it.matches(url) }
    }

    fun csrfToken(url: HttpUrl): String? = loadForRequest(url)
        .firstOrNull { it.name == "sa_csrf" && it.matches(url) }
        ?.value

    fun clear() = synchronized(lock) {
        memory.clear()
        prefs.edit().clear().apply()
    }

    private fun hydrate(url: HttpUrl) {
        prefs.all.forEach { (cookieKey, encrypted) ->
            val value = encrypted as? String
            val cookie = value?.let { runCatching { Cookie.parse(url, unseal(it)) }.getOrNull() }
            if (cookie == null) {
                prefs.edit().remove(cookieKey).apply()
            } else if (cookie.name in persistedNames && cookie.matches(url)) {
                memory[cookieKey] = cookie
            }
        }
    }

    private fun pruneExpired() {
        val expired = memory.filterValues { it.expiresAt <= System.currentTimeMillis() }.keys
        expired.forEach { key -> memory.remove(key); prefs.edit().remove(key).apply() }
    }

    private fun key(cookie: Cookie) = "${cookie.name}|${cookie.domain}|${cookie.path}"

    private fun secretKey(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build(),
        )
        return generator.generateKey()
    }

    private fun seal(value: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(cipher.iv + encrypted, Base64.NO_WRAP)
    }

    private fun unseal(value: String): String {
        val bytes = Base64.decode(value, Base64.NO_WRAP)
        require(bytes.size > GCM_IV_BYTES) { "Encrypted cookie is incomplete" }
        val iv = bytes.copyOfRange(0, GCM_IV_BYTES)
        val payload = bytes.copyOfRange(GCM_IV_BYTES, bytes.size)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(GCM_TAG_BITS, iv))
        return String(cipher.doFinal(payload), Charsets.UTF_8)
    }

    companion object {
        private const val KEY_ALIAS = "in.secureasset.android.session-cookie.v1"
        private const val GCM_IV_BYTES = 12
        private const val GCM_TAG_BITS = 128
        private val persistedNames = setOf("__Host-sa_session", "sa_csrf")
    }
}
