package `in`.secureasset.android.model

import org.json.JSONArray
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

data class UserProfile(
    val id: String,
    val name: String,
    val email: String,
    val phone: String,
    val role: String,
    val kycStatus: String,
    val landlordEnabled: Boolean,
    val surveyorEnabled: Boolean,
    val avatar: String,
) {
    val firstName: String get() = name.trim().split(Regex("\\s+")).firstOrNull().orEmpty().ifBlank { "there" }
    val hasLandlordMode: Boolean get() = landlordEnabled || role.equals("landlord", true) || role.equals("admin", true) || role.equals("super_admin", true)
    val isTenant: Boolean get() = role.equals("tenant", true) || role.equals("user", true)

    companion object {
        fun from(json: JSONObject?): UserProfile? {
            if (json == null) return null
            return UserProfile(
                id = json.optString("_id", json.optString("id")),
                name = json.optString("name").ifBlank { "SecureAsset member" },
                email = json.optString("email"),
                phone = json.optString("phone"),
                role = json.optString("role", "tenant"),
                kycStatus = json.optString("kycStatus", "not_started"),
                landlordEnabled = json.optBoolean("landlordEnabled") || json.optBoolean("landlordMode"),
                surveyorEnabled = json.optBoolean("surveyorEnabled") || json.optBoolean("surveyorMode"),
                avatar = json.optString("avatar"),
            )
        }
    }
}

data class RentalUnitOption(
    val id: String,
    val name: String,
    val floor: String,
    val price: Double,
    val area: Double,
    val areaUnit: String,
    val images: List<String>,
    val status: String,
)

data class PropertyListing(
    val id: String,
    val propertyId: String,
    val listingKind: String,
    val slug: String,
    val title: String,
    val type: String,
    val listingType: String,
    val price: Double,
    val area: Double,
    val areaUnit: String,
    val bedrooms: String,
    val bathrooms: String,
    val city: String,
    val state: String,
    val address: String,
    val description: String,
    val images: List<String>,
    val amenities: List<String>,
    val isVerified: Boolean,
    val isFeatured: Boolean,
    val ownerName: String,
    val ownerVerified: Boolean,
    val availableRoomCount: Int,
    val rentalUnits: List<RentalUnitOption> = emptyList(),
) {
    val formattedPrice: String
        get() = NumberFormat.getCurrencyInstance(Locale("en", "IN")).apply { maximumFractionDigits = 0 }.format(price)

    val priceSuffix: String
        get() = if (listingType.equals("rent", true)) "/ month" else ""

    val locationLabel: String
        get() = listOf(city, state).filter(String::isNotBlank).distinct().joinToString(", ").ifBlank { address.ifBlank { "India" } }

    companion object {
        fun from(source: JSONObject?, apiOrigin: String): PropertyListing? {
            if (source == null) return null
            val id = source.optString("_id", source.optString("id"))
            if (id.isBlank()) return null
            val addressObj = source.optJSONObject("address")
            val owner = source.optJSONObject("owner")
            val gallery = mutableListOf<String>()
            addImage(gallery, source.opt("galleryCover"), apiOrigin)
            addImages(gallery, source.optJSONArray("images"), apiOrigin)
            addImages(gallery, source.optJSONArray("media"), apiOrigin)
            val amenities = source.optJSONArray("amenities").toStringList()
            val units = source.optJSONArray("rentalUnits").toRentalUnits(apiOrigin)
            val price = source.optDouble("price", 0.0).takeIf { it > 0 }
                ?: source.optJSONObject("pricing")?.optDouble("monthlyRent", 0.0)
                ?: source.optJSONObject("pricing")?.optDouble("salePrice", 0.0)
            val city = addressObj?.optString("city").orEmpty().ifBlank { source.optString("city") }
            val state = addressObj?.optString("state").orEmpty()
            val formattedAddress = listOf(
                addressObj?.optString("locality"), addressObj?.optString("landmark"), city, state,
            ).filterNotNull().map(String::trim).filter(String::isNotBlank).distinct().joinToString(", ")
            return PropertyListing(
                id = id,
                propertyId = source.optString("propertyId").ifBlank { id },
                listingKind = source.optString("listingKind", "property").ifBlank { "property" },
                slug = source.optString("slug"),
                title = source.optString("title").ifBlank { source.optString("name", "Property") },
                type = source.optString("type").ifBlank { source.optString("customType", "Home") },
                listingType = source.optString("listingType").ifBlank { source.optString("purpose", "rent") },
                price = price ?: 0.0,
                area = source.optDouble("area", source.optJSONObject("areas")?.optDouble("builtUpSqft", 0.0) ?: 0.0),
                areaUnit = source.optString("areaUnit", "sqft").ifBlank { "sqft" },
                bedrooms = source.optString("bedrooms").ifBlank { source.optJSONObject("roomCounts")?.optString("bedrooms").orEmpty() },
                bathrooms = source.optString("bathrooms").ifBlank { source.optJSONObject("roomCounts")?.optString("bathrooms").orEmpty() },
                city = city,
                state = state,
                address = formattedAddress,
                description = source.optString("description"),
                images = gallery.distinct(),
                amenities = amenities,
                isVerified = source.optBoolean("isVerified") || source.optString("verificationStatus").equals("verified", true),
                isFeatured = source.optBoolean("isFeatured") || source.optJSONObject("promotion")?.optBoolean("featured") == true,
                ownerName = owner?.optString("name").orEmpty(),
                ownerVerified = owner?.optBoolean("verified") == true || owner?.optBoolean("trusted") == true,
                availableRoomCount = source.optInt("availableRoomCount"),
                rentalUnits = units,
            )
        }

        private fun addImages(target: MutableList<String>, values: JSONArray?, apiOrigin: String) {
            if (values == null) return
            for (i in 0 until values.length()) addImage(target, values.opt(i), apiOrigin)
        }

        private fun addImage(target: MutableList<String>, value: Any?, apiOrigin: String) {
            val raw = when (value) {
                is String -> value
                is JSONObject -> value.optString("url").ifBlank { value.optString("src") }
                else -> ""
            }.trim()
            if (raw.isBlank()) return
            target += if (raw.startsWith("/")) "$apiOrigin$raw" else raw
        }

        private fun JSONArray?.toRentalUnits(apiOrigin: String): List<RentalUnitOption> {
            if (this == null) return emptyList()
            return (0 until length()).mapNotNull { index ->
                val item = optJSONObject(index) ?: return@mapNotNull null
                val id = item.optString("_id")
                if (id.isBlank()) return@mapNotNull null
                val images = mutableListOf<String>()
                addImage(images, item.opt("primaryImage"), apiOrigin)
                addImages(images, item.optJSONArray("gallery"), apiOrigin)
                val price = item.optJSONObject("pricing")?.optDouble("monthlyRent", 0.0) ?: item.optDouble("price", 0.0)
                RentalUnitOption(
                    id = id,
                    name = item.optString("name").ifBlank { item.optString("roomNumber", "Available room") },
                    floor = item.optJSONObject("floor")?.optString("name").orEmpty(),
                    price = price,
                    area = item.optJSONObject("specifications")?.optDouble("area", 0.0) ?: 0.0,
                    areaUnit = item.optJSONObject("specifications")?.optString("areaUnit", "sqft").orEmpty(),
                    images = images,
                    status = item.optString("availabilityStatus", "AVAILABLE"),
                )
            }
        }

        private fun JSONArray?.toStringList(): List<String> {
            if (this == null) return emptyList()
            return (0 until length()).mapNotNull { optString(it).trim().takeIf(String::isNotBlank) }
        }
    }
}

data class ActivityRecord(
    val id: String,
    val title: String,
    val message: String,
    val status: String,
    val date: String,
    val category: String,
    val read: Boolean,
)

data class TenantKycProfile(
    val id: String = "",
    val status: String = "not_started",
    val reviewNote: String = "",
    val whatsappNumber: String = "",
    val governmentIdentityType: String = "",
    val governmentIdentityNumber: String = "",
    val governmentIdentityFront: String = "",
    val governmentIdentityBack: String = "",
    val addressProofType: String = "",
    val addressProofNumber: String = "",
    val addressProofFront: String = "",
    val addressProofBack: String = "",
    val passportPhoto: String = "",
) {
    fun withUploadedFile(category: String, reference: String): TenantKycProfile = when (category) {
        "tenant_government_identity_front" -> copy(governmentIdentityFront = reference)
        "tenant_government_identity_back" -> copy(governmentIdentityBack = reference)
        "tenant_address_proof_front" -> copy(addressProofFront = reference)
        "tenant_address_proof_back" -> copy(addressProofBack = reference)
        "tenant_passport_photo" -> copy(passportPhoto = reference)
        else -> this
    }

    companion object {
        fun from(source: JSONObject?): TenantKycProfile {
            if (source == null) return TenantKycProfile()
            val identity = source.optJSONObject("governmentIdentity") ?: source.optJSONObject("governmentIdDetails") ?: JSONObject()
            val address = source.optJSONObject("addressProofDetails") ?: source.optJSONObject("addressProof") ?: JSONObject()
            val photo = source.optJSONObject("passportPhoto") ?: source.optJSONObject("profilePhoto") ?: JSONObject()
            val status = source.optString("status")
                .ifBlank { source.optString("verificationStatus") }
                .ifBlank { source.optString("kycStatus") }
                .ifBlank { "not_started" }
            return TenantKycProfile(
                id = source.optString("_id", source.optString("id")),
                status = status,
                reviewNote = source.optString("reviewNote")
                    .ifBlank { source.optString("rejectionReason") }
                    .ifBlank { source.optString("reviewerComment") }
                    .ifBlank { source.optString("reason") },
                whatsappNumber = source.optString("whatsappNumber").ifBlank { source.optString("whatsapp") },
                governmentIdentityType = identity.optString("documentType"),
                governmentIdentityNumber = identity.optString("documentId").ifBlank { identity.optString("number") },
                governmentIdentityFront = fileReference(identity.opt("frontFile") ?: identity.opt("front") ?: source.opt("governmentId")),
                governmentIdentityBack = fileReference(identity.opt("backFile") ?: identity.opt("back")),
                addressProofType = address.optString("documentType"),
                addressProofNumber = address.optString("documentId").ifBlank { address.optString("number") },
                addressProofFront = fileReference(address.opt("frontFile") ?: address.opt("front") ?: source.opt("addressProof")),
                addressProofBack = fileReference(address.opt("backFile") ?: address.opt("back")),
                passportPhoto = fileReference(photo.opt("file") ?: photo.opt("fileId") ?: photo.opt("image") ?: source.opt("profilePhoto")),
            )
        }

        private fun fileReference(value: Any?): String = when (value) {
            is String -> value
            is JSONObject -> value.optString("driveFile").ifBlank { value.optString("_id") }.ifBlank { value.optString("id") }
            else -> ""
        }
    }
}

fun JSONArray?.objects(): List<JSONObject> {
    if (this == null) return emptyList()
    return (0 until length()).mapNotNull { optJSONObject(it) }
}
