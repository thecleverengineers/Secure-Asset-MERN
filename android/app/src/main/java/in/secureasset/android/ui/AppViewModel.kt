package in.secureasset.android.ui

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import in.secureasset.android.data.SecureAssetApi
import in.secureasset.android.model.ActivityRecord
import in.secureasset.android.model.PropertyListing
import in.secureasset.android.model.TenantKycProfile
import in.secureasset.android.model.UserProfile
import kotlinx.coroutines.launch
import org.json.JSONObject

enum class MainTab(val label: String) {
    HOME("Home"), EXPLORE("Explore"), SAVED("Saved"), ACTIVITY("Activity"), PROFILE("Profile"),
}

enum class AuthStage { LOGIN, REGISTER, REGISTER_OTP, TWO_FACTOR, FORGOT_PASSWORD, RESET_PASSWORD }

data class AppState(
    val bootstrapping: Boolean = true,
    val user: UserProfile? = null,
    val authStage: AuthStage = AuthStage.LOGIN,
    val authOpen: Boolean = false,
    val authBusy: Boolean = false,
    val authError: String = "",
    val challengeToken: String = "",
    val pendingPhone: String = "",
    val pendingIdentifier: String = "",
    val tab: MainTab = MainTab.HOME,
    val homeLoading: Boolean = false,
    val exploreLoading: Boolean = false,
    val savedLoading: Boolean = false,
    val activityLoading: Boolean = false,
    val ownedLoading: Boolean = false,
    val homeProperties: List<PropertyListing> = emptyList(),
    val exploreProperties: List<PropertyListing> = emptyList(),
    val savedProperties: List<PropertyListing> = emptyList(),
    val ownedProperties: List<PropertyListing> = emptyList(),
    val applications: List<ActivityRecord> = emptyList(),
    val notifications: List<ActivityRecord> = emptyList(),
    val query: String = "",
    val city: String = "",
    val listingType: String = "rent",
    val minPrice: String = "",
    val maxPrice: String = "",
    val selectedProperty: PropertyListing? = null,
    val detailLoading: Boolean = false,
    val applyOpen: Boolean = false,
    val kycOpen: Boolean = false,
    val kycLoading: Boolean = false,
    val kycBusy: Boolean = false,
    val kycProfile: TenantKycProfile? = null,
    val message: String = "",
)

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val api = SecureAssetApi(application)
    var state = androidx.compose.runtime.mutableStateOf(AppState())
        private set

    init { restoreSession() }

    private fun update(block: (AppState) -> AppState) { state.value = block(state.value) }

    private fun restoreSession() = viewModelScope.launch {
        val user = runCatching { api.restoreSession() }.getOrNull()
        update { it.copy(bootstrapping = false, user = user) }
        if (user != null) loadAuthedData()
        loadHome()
    }

    fun signIn(identifier: String, password: String) = viewModelScope.launch {
        update { it.copy(authBusy = true, authError = "") }
        runCatching { api.login(identifier, password) }
            .onSuccess { response ->
                val data = response.optJSONObject("data") ?: JSONObject()
                if (data.optBoolean("requiresTwoFactor") || data.optBoolean("twoFactorRequired")) {
                    update { it.copy(authBusy = false, authStage = AuthStage.TWO_FACTOR, challengeToken = data.optString("challengeToken")) }
                } else completeAuthentication(data)
            }
            .onFailure { error -> update { it.copy(authBusy = false, authError = error.message ?: "Sign in failed. Try again.") } }
    }

    fun submitTwoFactor(code: String) = viewModelScope.launch {
        val token = state.value.challengeToken
        if (token.isBlank()) { update { it.copy(authError = "Your sign-in challenge expired. Sign in again.", authStage = AuthStage.LOGIN) }; return@launch }
        update { it.copy(authBusy = true, authError = "") }
        runCatching { api.completeTwoFactor(token, code) }
            .onSuccess { response -> completeAuthentication(response.optJSONObject("data") ?: JSONObject()) }
            .onFailure { error -> update { it.copy(authBusy = false, authError = error.message ?: "Code could not be verified.") } }
    }

    fun register(name: String, email: String, phone: String, password: String) = viewModelScope.launch {
        update { it.copy(authBusy = true, authError = "") }
        runCatching { api.register(name, email, phone, password) }
            .onSuccess { response ->
                val data = response.optJSONObject("data") ?: JSONObject()
                update { it.copy(authBusy = false, authStage = AuthStage.REGISTER_OTP, pendingPhone = phone.trim(), message = data.optString("maskedMobile").takeIf(String::isNotBlank)?.let { "Code sent to $it" }.orEmpty()) }
            }
            .onFailure { error -> update { it.copy(authBusy = false, authError = error.message ?: "Registration could not be started.") } }
    }

    fun verifyRegistration(otp: String) = viewModelScope.launch {
        val phone = state.value.pendingPhone
        update { it.copy(authBusy = true, authError = "") }
        runCatching { api.verifyRegistration(phone, otp) }
            .onSuccess { response -> completeAuthentication(response.optJSONObject("data") ?: JSONObject()) }
            .onFailure { error -> update { it.copy(authBusy = false, authError = error.message ?: "Verification code is invalid.") } }
    }

    fun requestPasswordReset(identifier: String) = viewModelScope.launch {
        if (identifier.isBlank()) {
            update { it.copy(authError = "Enter the email address or phone number on your account.") }
            return@launch
        }
        update { it.copy(authBusy = true, authError = "", message = "") }
        runCatching { api.requestPasswordReset(identifier) }
            .onSuccess { response ->
                update {
                    it.copy(
                        authBusy = false,
                        authStage = AuthStage.RESET_PASSWORD,
                        pendingIdentifier = identifier.trim(),
                        message = response.optString("message").ifBlank { "If that account exists, a reset code has been sent." },
                    )
                }
            }
            .onFailure { error -> update { it.copy(authBusy = false, authError = error.message ?: "A reset code could not be sent.") } }
    }

    fun submitPasswordReset(otp: String, password: String) = viewModelScope.launch {
        val identifier = state.value.pendingIdentifier
        if (identifier.isBlank()) {
            update { it.copy(authStage = AuthStage.FORGOT_PASSWORD, authError = "Enter your account email or phone number first.") }
            return@launch
        }
        if (otp.isBlank() || password.length < 8) {
            update { it.copy(authError = "Enter the reset code and a password with at least 8 characters.") }
            return@launch
        }
        update { it.copy(authBusy = true, authError = "", message = "") }
        runCatching { api.resetPassword(identifier, otp, password) }
            .onSuccess { response ->
                update {
                    it.copy(
                        authBusy = false,
                        authStage = AuthStage.LOGIN,
                        pendingIdentifier = "",
                        message = response.optString("message").ifBlank { "Your password has been reset. Sign in with the new password." },
                    )
                }
            }
            .onFailure { error -> update { it.copy(authBusy = false, authError = error.message ?: "Your password could not be reset.") } }
    }

    private fun completeAuthentication(data: JSONObject) {
        viewModelScope.launch {
            val user = UserProfile.from(data.optJSONObject("user")) ?: runCatching { api.currentUser() }.getOrNull()
            if (user == null) {
                update { it.copy(authBusy = false, authError = "SecureAsset did not return an account profile. Please try signing in again.") }
            } else {
                update { it.copy(user = user, authBusy = false, authOpen = false, authError = "", authStage = AuthStage.LOGIN, challengeToken = "", pendingPhone = "", pendingIdentifier = "", tab = MainTab.HOME, message = "Welcome to SecureAsset") }
                loadAuthedData()
                loadHome()
            }
        }
    }

    fun changeAuthStage(stage: AuthStage) = update { it.copy(authOpen = true, authStage = stage, authError = "", message = "") }

    fun openAuth(stage: AuthStage = AuthStage.LOGIN, reason: String = "") = update {
        it.copy(authOpen = true, authStage = stage, authError = "", message = reason)
    }

    fun closeAuth() = update { it.copy(authOpen = false, authError = "", message = "") }

    fun openTab(tab: MainTab) {
        update { it.copy(tab = tab, selectedProperty = null, applyOpen = false, message = "") }
        when (tab) {
            MainTab.HOME -> loadHome()
            MainTab.EXPLORE -> search()
            MainTab.SAVED -> loadSaved()
            MainTab.ACTIVITY -> loadActivity()
            MainTab.PROFILE -> if (state.value.user?.hasLandlordMode == true) loadOwnedProperties()
        }
    }

    fun setQuery(value: String) = update { it.copy(query = value) }
    fun setCity(value: String) = update { it.copy(city = value) }
    fun setListingType(value: String) = update { it.copy(listingType = value.lowercase()) }
    fun setPriceRange(min: String, max: String) = update { it.copy(minPrice = min, maxPrice = max) }

    fun loadHome() = viewModelScope.launch {
        update { it.copy(homeLoading = it.homeProperties.isEmpty()) }
        runCatching { api.publicProperties(listingType = "rent", page = 1) }
            .onSuccess { items -> update { it.copy(homeLoading = false, homeProperties = items, message = "") } }
            .onFailure { error -> update { it.copy(homeLoading = false, message = error.message ?: "Properties could not be loaded.") } }
    }

    fun search() = viewModelScope.launch {
        update { it.copy(exploreLoading = true, message = "") }
        val current = state.value
        runCatching { api.publicProperties(current.listingType, current.query, current.city, current.minPrice, current.maxPrice) }
            .onSuccess { items -> update { it.copy(exploreLoading = false, exploreProperties = items, message = "") } }
            .onFailure { error -> update { it.copy(exploreLoading = false, message = error.message ?: "Search is unavailable right now.") } }
    }

    private fun loadAuthedData() {
        loadSaved()
        loadActivity()
        if (state.value.user?.hasLandlordMode == true) loadOwnedProperties()
    }

    fun loadSaved() = viewModelScope.launch {
        if (state.value.user == null) return@launch
        update { it.copy(savedLoading = true) }
        runCatching { api.wishlist() }
            .onSuccess { items -> update { it.copy(savedLoading = false, savedProperties = items) } }
            .onFailure { error -> update { it.copy(savedLoading = false, message = error.message ?: "Saved listings could not be loaded.") } }
    }

    fun loadActivity() = viewModelScope.launch {
        if (state.value.user == null) return@launch
        update { it.copy(activityLoading = true) }
        val notifications = runCatching { api.notifications() }
        val applications = runCatching { api.applications() }
        update {
            it.copy(
                activityLoading = false,
                notifications = notifications.getOrDefault(it.notifications),
                applications = applications.getOrDefault(it.applications),
                message = listOfNotNull(notifications.exceptionOrNull()?.message, applications.exceptionOrNull()?.message).firstOrNull().orEmpty(),
            )
        }
    }

    private fun loadOwnedProperties() = viewModelScope.launch {
        update { it.copy(ownedLoading = true) }
        runCatching { api.ownedProperties() }
            .onSuccess { items -> update { it.copy(ownedLoading = false, ownedProperties = items) } }
            .onFailure { error -> update { it.copy(ownedLoading = false, message = error.message ?: "Your properties could not be loaded.") } }
    }

    fun openProperty(listing: PropertyListing) = viewModelScope.launch {
        update { it.copy(selectedProperty = listing, detailLoading = true, applyOpen = false, message = "") }
        runCatching { api.publicProperty(listing.id) }
            .onSuccess { detail -> update { it.copy(selectedProperty = detail, detailLoading = false) } }
            .onFailure { error -> update { it.copy(selectedProperty = listing, detailLoading = false, message = error.message ?: "Some property details could not be loaded.") } }
    }

    fun closeProperty() = update { it.copy(selectedProperty = null, applyOpen = false, message = "") }

    fun isSaved(listing: PropertyListing): Boolean = state.value.savedProperties.any { it.id == listing.id && it.listingKind == listing.listingKind }

    fun toggleSaved(listing: PropertyListing) = viewModelScope.launch {
        if (state.value.user == null) {
            openAuth(reason = "Sign in to save this home.")
            return@launch
        }
        if (state.value.user?.isTenant != true) {
            update { it.copy(message = "Saved listings are available on tenant accounts.") }
            return@launch
        }
        val wasSaved = isSaved(listing)
        if (wasSaved) {
            update { it.copy(savedProperties = it.savedProperties.filterNot { item -> item.id == listing.id }) }
            runCatching { api.removeWishlist(listing) }
                .onFailure { error -> update { it.copy(message = error.message ?: "Could not remove the saved listing.") }; loadSaved() }
        } else {
            update { it.copy(savedProperties = listOf(listing) + it.savedProperties) }
            runCatching { api.addWishlist(listing) }
                .onFailure { error -> update { it.copy(message = error.message ?: "Could not save this listing.") }; loadSaved() }
        }
    }

    fun markRead(item: ActivityRecord) = viewModelScope.launch {
        if (item.id.isBlank() || item.read) return@launch
        runCatching { api.markNotificationRead(item.id) }
            .onSuccess { update { it.copy(notifications = it.notifications.map { note -> if (note.id == item.id) note.copy(read = true) else note }) } }
            .onFailure { error -> update { it.copy(message = error.message ?: "Could not mark the notification read.") } }
    }

    fun beginApplication(selectedUnitId: String?) {
        val user = state.value.user
        val listing = state.value.selectedProperty ?: return
        if (user == null) { openAuth(reason = "Sign in to apply for this home."); return }
        if (!user.isTenant) { update { it.copy(message = "Applications are available on tenant accounts.") }; return }
        if (!user.kycStatus.equals("verified", true)) {
            val status = user.kycStatus.lowercase()
            if (status in setOf("pending", "submitted", "under_review", "in_review")) {
                update { it.copy(message = "Your tenant verification is under review. You can apply once it is approved.") }
            } else {
                openKyc()
            }
            return
        }
        if (listing.listingType.equals("rent", true) && listing.availableRoomCount > 0 && listing.rentalUnits.isEmpty()) {
            update { it.copy(message = "Choose an available room in the listing before applying.") }
            return
        }
        if (listing.listingType.equals("rent", true) && listing.rentalUnits.isNotEmpty()) {
            val unit = listing.rentalUnits.firstOrNull { it.id == selectedUnitId }
            if (unit == null || !(unit.status.equals("AVAILABLE", true) || unit.status.equals("APPLICATION_PENDING", true))) {
                update { it.copy(message = "Select an available room before applying.") }
                return
            }
        }
        update { it.copy(applyOpen = true, message = "") }
    }

    fun openKyc() {
        if (state.value.user?.isTenant != true) {
            update { it.copy(message = "Tenant verification is available on tenant accounts.") }
            return
        }
        update { it.copy(kycOpen = true, kycLoading = true, message = "") }
        viewModelScope.launch {
            val user = state.value.user
            runCatching { api.tenantKyc(user?.id.orEmpty()) }
                .onSuccess { record ->
                    val parsed = TenantKycProfile.from(record)
                    val profile = parsed.copy(
                        status = if (parsed.status == "not_started" && !user?.kycStatus.isNullOrBlank()) user?.kycStatus.orEmpty() else parsed.status,
                        whatsappNumber = parsed.whatsappNumber.ifBlank { user?.phone.orEmpty() },
                    )
                    update { it.copy(kycLoading = false, kycProfile = profile) }
                }
                .onFailure { error -> update { it.copy(kycLoading = false, kycProfile = it.kycProfile ?: TenantKycProfile(), message = error.message ?: "Verification details could not be loaded.") } }
        }
    }

    fun closeKyc() = update { it.copy(kycOpen = false, kycBusy = false, message = "") }

    fun uploadKycFile(category: String, uri: Uri) = viewModelScope.launch {
        update { it.copy(kycBusy = true, message = "") }
        runCatching { api.uploadTenantKycFile(uri, category) }
            .onSuccess { reference ->
                update { current ->
                    val profile = current.kycProfile ?: TenantKycProfile()
                    current.copy(kycBusy = false, kycProfile = profile.withUploadedFile(category, reference), message = "")
                }
            }
            .onFailure { error -> update { it.copy(kycBusy = false, message = error.message ?: "The document could not be uploaded.") } }
    }

    fun submitKyc(whatsapp: String, governmentType: String, governmentNumber: String, addressType: String, addressNumber: String) = viewModelScope.launch {
        val profile = state.value.kycProfile ?: TenantKycProfile()
        val digits = whatsapp.filter(Char::isDigit).let { raw ->
            when {
                raw.length == 12 && raw.startsWith("91") -> raw.substring(2)
                raw.length == 11 && raw.startsWith("0") -> raw.substring(1)
                else -> raw
            }
        }
        if (!digits.matches(Regex("^[6-9]\\d{9}$")) || governmentType.isBlank() || governmentNumber.isBlank() || profile.governmentIdentityFront.isBlank() ||
            addressType.isBlank() || addressNumber.isBlank() || profile.addressProofFront.isBlank() || profile.addressProofBack.isBlank() || profile.passportPhoto.isBlank()) {
            update { it.copy(message = "Add a valid WhatsApp number and upload every required document before submitting.") }
            return@launch
        }
        val governmentIdentity = JSONObject()
            .put("documentType", governmentType.trim())
            .put("documentId", governmentNumber.trim())
            .put("frontFile", profile.governmentIdentityFront)
        if (profile.governmentIdentityBack.isNotBlank()) governmentIdentity.put("backFile", profile.governmentIdentityBack)
        val addressProof = JSONObject()
            .put("documentType", addressType.trim())
            .put("documentId", addressNumber.trim())
            .put("frontFile", profile.addressProofFront)
            .put("backFile", profile.addressProofBack)
        val passportPhoto = JSONObject().put("file", profile.passportPhoto).put("requirementsAccepted", true)
        val payload = JSONObject()
            .put("whatsappNumber", digits)
            .put("governmentIdentity", governmentIdentity)
            .put("addressProofDetails", addressProof)
            .put("passportPhoto", passportPhoto)
            .put("governmentId", profile.governmentIdentityFront)
            .put("addressProof", profile.addressProofFront)
            .put("profilePhoto", profile.passportPhoto)
        update { it.copy(kycBusy = true, message = "") }
        runCatching { api.submitTenantKyc(payload) }
            .onSuccess { response ->
                val refreshed = runCatching { api.currentUser() }.getOrNull()
                val responseStatus = response.optJSONObject("data")?.optString("status").orEmpty().ifBlank { "pending" }
                update { current ->
                    current.copy(
                        user = refreshed ?: current.user?.copy(kycStatus = responseStatus),
                        kycBusy = false,
                        kycOpen = false,
                        kycProfile = profile.copy(status = responseStatus, whatsappNumber = digits),
                        message = "Verification submitted. We’ll let you know when it has been reviewed.",
                    )
                }
            }
            .onFailure { error -> update { it.copy(kycBusy = false, message = error.message ?: "Your verification could not be submitted.") } }
    }

    fun updateKycWhatsapp(whatsapp: String) = viewModelScope.launch {
        val digits = whatsapp.filter(Char::isDigit).let { raw ->
            when {
                raw.length == 12 && raw.startsWith("91") -> raw.substring(2)
                raw.length == 11 && raw.startsWith("0") -> raw.substring(1)
                else -> raw
            }
        }
        if (!digits.matches(Regex("^[6-9]\\d{9}$"))) {
            update { it.copy(message = "Enter a valid 10-digit Indian WhatsApp number.") }
            return@launch
        }
        update { it.copy(kycBusy = true, message = "") }
        runCatching { api.updateTenantKycWhatsapp(digits) }
            .onSuccess { response ->
                update { current ->
                    current.copy(kycBusy = false, kycProfile = (current.kycProfile ?: TenantKycProfile()).copy(whatsappNumber = digits), message = response.optString("message").ifBlank { "WhatsApp number updated." })
                }
            }
            .onFailure { error -> update { it.copy(kycBusy = false, message = error.message ?: "WhatsApp number could not be updated.") } }
    }

    fun closeApplication() = update { it.copy(applyOpen = false) }

    fun submitApplication(
        unitId: String?, fullName: String, phone: String, email: String, occupation: String, employer: String,
        income: String, identityType: String, identityNumber: String, currentAddress: String,
        moveInDate: String, stayMonths: Int, message: String,
    ) = viewModelScope.launch {
        val listing = state.value.selectedProperty ?: return@launch
        val monthlyIncome = income.toDoubleOrNull()
        if (fullName.isBlank() || phone.isBlank() || email.isBlank() || occupation.isBlank() || monthlyIncome == null || monthlyIncome <= 0 || identityType.isBlank() || identityNumber.isBlank() || currentAddress.isBlank() || moveInDate.isBlank() || stayMonths <= 0) {
            update { it.copy(message = "Complete the required applicant details before submitting.") }
            return@launch
        }
        update { it.copy(authBusy = true, message = "") }
        runCatching {
            api.createApplication(listing, unitId, fullName, phone, email, occupation, employer, monthlyIncome, identityType, identityNumber, currentAddress, moveInDate, stayMonths, message)
        }.onSuccess {
            update { it.copy(authBusy = false, applyOpen = false, tab = MainTab.ACTIVITY, message = "Application submitted successfully.") }
            loadActivity()
        }.onFailure { error -> update { it.copy(authBusy = false, message = error.message ?: "Your application could not be submitted.") } }
    }

    fun signOut() = viewModelScope.launch {
        api.logout()
        update { AppState(bootstrapping = false, homeLoading = true, message = "You have signed out.") }
        loadHome()
    }

    fun clearMessage() = update { it.copy(message = "") }
}
