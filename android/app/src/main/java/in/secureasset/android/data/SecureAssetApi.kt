package `in`.secureasset.android.data

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import `in`.secureasset.android.BuildConfig
import `in`.secureasset.android.model.ActivityRecord
import `in`.secureasset.android.model.PropertyListing
import `in`.secureasset.android.model.UserProfile
import `in`.secureasset.android.model.objects
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.RequestBody
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiException(message: String, val statusCode: Int? = null) : IOException(message)

class SecureAssetApi(context: Context) {
    private val appContext = context.applicationContext
    private val baseUrl = BuildConfig.SECURE_ASSET_API_BASE_URL.trimEnd('/').plus("/").toHttpUrl()
    private val origin = "${baseUrl.scheme}://${baseUrl.host}${if (baseUrl.port != 443) ":${baseUrl.port}" else ""}"
    private val cookies = SecureCookieJar(context, baseUrl.host)
    private val client = OkHttpClient.Builder()
        .cookieJar(cookies)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .writeTimeout(45, TimeUnit.SECONDS)
        .callTimeout(90, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            val request = chain.request()
            val builder = request.newBuilder()
                .header("Accept", "application/json")
                .header("User-Agent", "SecureAsset-Android/1.0.0")
            if (request.method !in safeMethods) {
                cookies.csrfToken(request.url)?.let { builder.header("X-SecureAsset-CSRF", it) }
            }
            chain.proceed(builder.build())
        }
        .build()

    suspend fun restoreSession(): UserProfile? {
        val response = request("POST", "auth/refresh", JSONObject(), allowRefresh = false)
        return userFrom(response)
    }

    suspend fun login(identifier: String, password: String): JSONObject = request(
        "POST", "auth/login", JSONObject().put("identifier", identifier.trim()).put("password", password), allowRefresh = false,
    )

    suspend fun completeTwoFactor(challengeToken: String, code: String): JSONObject = request(
        "POST", "auth/two-factor/challenge", JSONObject().put("challengeToken", challengeToken).put("code", code.trim()), allowRefresh = false,
    )

    suspend fun register(name: String, email: String, phone: String, password: String): JSONObject = request(
        "POST", "auth/register", JSONObject()
            .put("name", name.trim())
            .put("email", email.trim())
            .put("phone", phone.trim())
            .put("password", password),
        allowRefresh = false,
    )

    suspend fun verifyRegistration(phone: String, otp: String): JSONObject = request(
        "POST", "auth/register/verify", JSONObject().put("phone", phone.trim()).put("otp", otp.trim()), allowRefresh = false,
    )

    suspend fun requestPasswordReset(identifier: String): JSONObject = request(
        "POST", "auth/forgot-password", JSONObject().put("identifier", identifier.trim()), allowRefresh = false,
    )

    suspend fun resetPassword(identifier: String, otp: String, password: String): JSONObject = request(
        "POST", "auth/reset-password", JSONObject()
            .put("identifier", identifier.trim())
            .put("otp", otp.trim())
            .put("password", password),
        allowRefresh = false,
    )

    suspend fun currentUser(): UserProfile? {
        val response = request("GET", "auth/me")
        return userFrom(response)
    }

    suspend fun logout() {
        runCatching { request("POST", "auth/logout", JSONObject(), allowRefresh = false) }
        cookies.clear()
    }

    suspend fun publicProperties(
        listingType: String = "rent",
        search: String = "",
        city: String = "",
        minPrice: String = "",
        maxPrice: String = "",
        page: Int = 1,
    ): List<PropertyListing> {
        val query = linkedMapOf("page" to page.toString(), "limit" to "24", "listingType" to listingType)
        if (search.isNotBlank()) query["search"] = search.trim()
        if (city.isNotBlank()) query["city"] = city.trim()
        if (minPrice.isNotBlank()) query["minPrice"] = minPrice.trim()
        if (maxPrice.isNotBlank()) query["maxPrice"] = maxPrice.trim()
        val response = request("GET", "public/properties", query = query)
        return response.optJSONArray("data").objects().mapNotNull { PropertyListing.from(it, origin) }
    }

    suspend fun publicProperty(id: String): PropertyListing {
        val response = request("GET", "public/properties/${id.trim()}")
        val data = response.optJSONObject("data") ?: response
        val structure = data.optJSONObject("structure")
        val listingJson = data.optJSONObject("listing") ?: structure?.optJSONObject("property") ?: data
        val listing = PropertyListing.from(listingJson, origin) ?: throw ApiException("Property details are unavailable")
        val units = structure?.optJSONArray("rentalUnits") ?: data.optJSONArray("rentalUnits")
        val unitSource = JSONObject().put("_id", listing.id).put("rentalUnits", units)
        val parsedUnits = PropertyListing.from(unitSource, origin)?.rentalUnits.orEmpty()
        return listing.copy(rentalUnits = parsedUnits)
    }

    suspend fun wishlist(): List<PropertyListing> {
        val response = request("GET", "wishlist")
        return response.optJSONArray("data").objects().mapNotNull { item ->
            val listing = item.optJSONObject("listing") ?: return@mapNotNull null
            PropertyListing.from(listing, origin)
        }
    }

    suspend fun addWishlist(listing: PropertyListing) {
        request("POST", "wishlist", JSONObject().put("listingId", listing.id).put("listingKind", listing.listingKind))
    }

    suspend fun removeWishlist(listing: PropertyListing) {
        request(
            "DELETE", "wishlist/${listing.id}",
            query = mapOf("listingKind" to listing.listingKind),
        )
    }

    suspend fun notifications(): List<ActivityRecord> {
        val response = request("GET", "notifications", query = mapOf("page" to "1", "limit" to "40"))
        return response.optJSONArray("data").objects().map { item ->
            ActivityRecord(
                id = item.optString("_id", item.optString("id")),
                title = item.optString("title").ifBlank { "SecureAsset update" },
                message = item.optString("message"),
                status = item.optString("status"),
                date = item.optString("createdAt"),
                category = item.optString("category", "system"),
                read = item.optBoolean("read") || item.optBoolean("isRead"),
            )
        }
    }

    suspend fun markNotificationRead(id: String) {
        request("PATCH", "notifications/${id.trim()}/read", JSONObject())
    }

    suspend fun applications(): List<ActivityRecord> = activityList("resources/applications/mine")

    suspend fun tenantKyc(userId: String): JSONObject {
        val response = request("GET", "resources/tenant-kyc", query = mapOf("limit" to "10"))
        val data = response.opt("data")
        return when (data) {
            is JSONArray -> firstKycRecord(data, userId)
            is JSONObject -> {
                val records = data.optJSONArray("items") ?: data.optJSONArray("records")
                when {
                    records != null -> firstKycRecord(records, userId)
                    data.optJSONObject("tenantKyc") != null -> data.optJSONObject("tenantKyc") ?: JSONObject()
                    else -> data
                }
            }
            else -> JSONObject()
        }
    }

    suspend fun updateTenantKycWhatsapp(whatsappNumber: String): JSONObject = request(
        "PATCH", "property-management/kyc/whatsapp", JSONObject().put("whatsappNumber", whatsappNumber),
    )

    suspend fun uploadTenantKycFile(uri: Uri, category: String): String = withContext(Dispatchers.IO) {
        val resolver = appContext.contentResolver
        val displayName = resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        }
        val mime = resolver.getType(uri).orEmpty().lowercase()
        val guessedExt = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime).orEmpty().lowercase()
        val name = displayName?.takeIf { it.contains('.') } ?: "tenant-document-${System.currentTimeMillis()}.$guessedExt"
        val extension = name.substringAfterLast('.', "").lowercase()
        if (extension !in setOf("jpg", "jpeg", "png", "pdf")) throw ApiException("Choose a JPG, PNG, or PDF document.")
        if (category == "tenant_passport_photo" && extension == "pdf") throw ApiException("Passport photo must be a JPG or PNG image.")
        val detectedMime = when (extension) {
            "jpg", "jpeg" -> "image/jpeg"
            "png" -> "image/png"
            "pdf" -> "application/pdf"
            else -> mime.ifBlank { "application/octet-stream" }
        }
        val limit = if (category == "tenant_passport_photo") 2 * 1024 * 1024 else 8 * 1024 * 1024
        val bytes = resolver.openInputStream(uri)?.use { input ->
            val output = java.io.ByteArrayOutputStream()
            val buffer = ByteArray(8192)
            var total = 0
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                total += read
                if (total > limit) throw ApiException(if (category == "tenant_passport_photo") "Passport photo must be 2 MB or smaller." else "Document must be 8 MB or smaller.")
                output.write(buffer, 0, read)
            }
            output.toByteArray()
        } ?: throw ApiException("Could not read the selected file.")
        val safeName = name.replace(Regex("[^A-Za-z0-9._-]"), "_").takeLast(120).ifBlank { "tenant-document.$extension" }
        val multipart = MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart("file", safeName, bytes.toRequestBody(detectedMime.toMediaType()))
            .addFormDataPart("type", "tenant_kyc")
            .addFormDataPart("category", category)
            .addFormDataPart("description", "${category.replace('_', ' ')} uploaded for tenant KYC")
            .addFormDataPart("visibility", "private")
            .build()
        val response = requestRaw("POST", "uploads/document", multipart)
        val uploaded = response.optJSONObject("data") ?: JSONObject()
        val reference = fileReference(uploaded.opt("driveFile") ?: uploaded.opt("document") ?: uploaded.opt("_id"))
        reference.takeIf(String::isNotBlank)
            ?: throw ApiException("The file was uploaded but SecureAsset did not return a document reference.")
    }

    suspend fun submitTenantKyc(payload: JSONObject): JSONObject = request("POST", "property-management/kyc/submit", payload)

    suspend fun ownedProperties(): List<PropertyListing> {
        val response = request("GET", "resources/properties/mine", query = mapOf("page" to "1", "limit" to "40"))
        return response.optJSONArray("data").objects().mapNotNull { PropertyListing.from(it, origin) }
    }

    suspend fun landlordOverview(): JSONObject = request("GET", "property-management/landlord-overview")

    suspend fun createApplication(
        listing: PropertyListing,
        rentalUnitId: String?,
        fullName: String,
        phone: String,
        email: String,
        occupation: String,
        employer: String,
        monthlyIncome: Double,
        identityType: String,
        identityNumber: String,
        currentAddress: String,
        moveInDate: String,
        stayMonths: Int,
        message: String,
    ) {
        val payload = JSONObject()
            .put("property", listing.propertyId)
            .put("moveInDate", moveInDate)
            .put("expectedStayMonths", stayMonths)
            .put("monthlyIncome", monthlyIncome)
            .put("rentalBudget", listing.price)
            .put("occupantSummary", JSONObject().put("total", 1).put("adults", 1).put("children", 0))
            .put("personal", JSONObject()
                .put("name", fullName.trim())
                .put("email", email.trim())
                .put("phone", phone.trim())
                .put("gender", "Prefer not to say")
                .put("occupation", occupation.trim())
                .put("purposeOfStay", "Residential")
                .put("consent", JSONObject().put("accepted", true).put("acceptedAt", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", java.util.Locale.US).format(java.util.Date()))))
            .put("employment", JSONObject()
                .put("employer", employer.trim())
                .put("occupation", occupation.trim())
                .put("monthlyIncome", monthlyIncome)
                .put("employmentType", "Full-time"))
            .put("identity", JSONObject()
                .put("type", identityType.trim())
                .put("number", identityNumber.trim())
                .put("currentAddress", currentAddress.trim()))
            .put("references", JSONArray())
            .put("documents", JSONArray())
            .put("messageToLandlord", message.trim())
        if (listing.listingKind == "space") payload.put("targetSpace", listing.id)
        if (!rentalUnitId.isNullOrBlank()) payload.put("rentalUnit", rentalUnitId)
        request("POST", "property-management/applications", payload)
    }

    fun clearCookies() = cookies.clear()

    private fun userFrom(response: JSONObject): UserProfile? {
        val data = response.optJSONObject("data") ?: return null
        return UserProfile.from(data.optJSONObject("user") ?: data)
    }

    private fun firstKycRecord(records: JSONArray, userId: String): JSONObject {
        val items = records.objects()
        if (items.isEmpty()) return JSONObject()
        val match = items.firstOrNull { record ->
            val owner = record.opt("user")
            val recordUserId = when (owner) {
                is JSONObject -> owner.optString("_id", owner.optString("id"))
                is String -> owner
                else -> ""
            }
            recordUserId == userId && userId.isNotBlank()
        }
        return match ?: items.first()
    }

    private fun fileReference(value: Any?): String = when (value) {
        is String -> value
        is JSONObject -> value.optString("driveFile").ifBlank { value.optString("fileId") }.ifBlank { value.optString("_id") }.ifBlank { value.optString("id") }
        else -> ""
    }

    private suspend fun activityList(path: String): List<ActivityRecord> {
        val response = request("GET", path, query = mapOf("page" to "1", "limit" to "40"))
        return response.optJSONArray("data").objects().map { item ->
            ActivityRecord(
                id = item.optString("_id", item.optString("id")),
                title = item.optString("propertyTitle").ifBlank { item.optString("applicationNumber", "Rental application") },
                message = item.optString("status").replace('_', ' ').replaceFirstChar { it.uppercase() },
                status = item.optString("status"),
                date = item.optString("updatedAt", item.optString("createdAt")),
                category = "application",
                read = true,
            )
        }
    }

    private suspend fun request(
        method: String,
        path: String,
        body: JSONObject? = null,
        query: Map<String, String> = emptyMap(),
        allowRefresh: Boolean = true,
    ): JSONObject {
        val requestBody = if (method in bodyMethods) (body ?: JSONObject()).toString().toRequestBody(JSON_TYPE) else null
        return requestRaw(method, path, requestBody, query, allowRefresh)
    }

    private suspend fun requestRaw(
        method: String,
        path: String,
        requestBody: RequestBody?,
        query: Map<String, String> = emptyMap(),
        allowRefresh: Boolean = true,
    ): JSONObject = withContext(Dispatchers.IO) {
        val httpUrl = buildUrl(path, query)
        val requestBuilder = Request.Builder().url(httpUrl)
        requestBuilder.method(method, requestBody)
        val response = runCatching { client.newCall(requestBuilder.build()).execute() }
            .getOrElse { throw ApiException("Unable to reach SecureAsset. Check your connection and try again.") }

        val statusCode = response.code
        val contentType = response.header("Content-Type").orEmpty()
        val raw = response.body?.string().orEmpty()
        response.close()
        if (contentType.contains("text/html", ignoreCase = true)) {
            throw ApiException("The server returned a webpage instead of API data. Check the API URL and proxy configuration.", statusCode)
        }
        val payload = runCatching { if (raw.isBlank()) JSONObject() else JSONObject(raw) }.getOrElse { JSONObject() }

        if (statusCode == 401 && allowRefresh && !path.startsWith("auth/")) {
            val refreshed = runCatching { request("POST", "auth/refresh", JSONObject(), allowRefresh = false) }.getOrNull()
            if (refreshed?.optBoolean("success") == true) {
                return@withContext requestRaw(method, path, requestBody, query, allowRefresh = false)
            }
            cookies.clear()
        }

        val message = payload.optString("message").ifBlank { "Request failed ($statusCode)" }
        if (statusCode !in 200..299 || payload.optBoolean("success") == false) throw ApiException(message, statusCode)
        payload
    }

    private fun buildUrl(path: String, query: Map<String, String>): HttpUrl {
        val builder = baseUrl.newBuilder().addPathSegments(path.trim('/'))
        query.forEach { (key, value) -> if (value.isNotBlank()) builder.addQueryParameter(key, value) }
        return builder.build()
    }

    companion object {
        private val JSON_TYPE = "application/json; charset=utf-8".toMediaType()
        private val safeMethods = setOf("GET", "HEAD", "OPTIONS")
        private val bodyMethods = setOf("POST", "PUT", "PATCH")
    }
}
