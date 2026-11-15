package `in`.secureasset.android.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import `in`.secureasset.android.model.TenantKycProfile
import `in`.secureasset.android.ui.components.MessageStrip
import `in`.secureasset.android.ui.components.ScreenHeading
import `in`.secureasset.android.ui.theme.Accent
import `in`.secureasset.android.ui.theme.Border
import `in`.secureasset.android.ui.theme.Ink
import `in`.secureasset.android.ui.theme.Muted
import `in`.secureasset.android.ui.theme.PaleBlue
import `in`.secureasset.android.ui.theme.PaleGreen
import `in`.secureasset.android.ui.theme.Surface as AppSurface

private val GovernmentIdentityOptions = listOf(
    "Aadhaar Card — identity and address verification" to "Aadhaar Card",
    "PAN Card — financial and tax verification; especially important for buying or selling property" to "PAN Card",
    "Voter ID / EPIC — identity and address verification" to "Voter ID / EPIC",
    "Passport — identity, nationality and address verification" to "Passport",
    "Driving Licence — identity and address verification" to "Driving Licence",
    "Government-issued Employee ID — supplementary identity proof" to "Employee ID",
    "NREGA Job Card — identity and address proof where applicable" to "NREGA Job Card",
    "OCI Card — for Overseas Citizens of India" to "OCI Card",
    "Foreign Passport and valid Visa — for foreign tenants or buyers" to "Foreign Passport + Visa",
)

private val AddressProofOptions = listOf(
    "Aadhaar Card" to "Aadhaar Card",
    "Passport" to "Passport",
    "Voter ID Card" to "Voter ID",
    "Driving Licence" to "Driving Licence",
    "Ration Card" to "Ration Card",
    "Recent electricity bill" to "Electricity bill",
    "Recent water bill" to "Water bill",
    "Recent gas bill" to "Gas bill",
    "Recent landline telephone bill" to "Telephone bill",
    "Property tax receipt" to "Property tax receipt",
    "Registered rent or lease agreement" to "Rent or lease agreement",
    "Bank statement or bank passbook showing the current address" to "Bank statement",
    "Government-issued residence or domicile certificate" to "Domicile certificate",
    "Employer-issued accommodation letter, where applicable" to "Employer letter",
)

@Composable
fun TenantKycScreen(
    profile: TenantKycProfile?,
    loading: Boolean,
    busy: Boolean,
    message: String,
    onBack: () -> Unit,
    onUpload: (String, Uri) -> Unit,
    onSubmit: (String, String, String, String, String) -> Unit,
    onUpdateWhatsApp: (String) -> Unit,
    onClearMessage: () -> Unit,
) {
    val safeProfile = profile ?: TenantKycProfile()
    var whatsapp by remember(safeProfile.id) { mutableStateOf(safeProfile.whatsappNumber) }
    var governmentType by remember(safeProfile.id) { mutableStateOf(safeProfile.governmentIdentityType) }
    var governmentNumber by remember(safeProfile.id) { mutableStateOf(safeProfile.governmentIdentityNumber) }
    var addressType by remember(safeProfile.id) { mutableStateOf(safeProfile.addressProofType) }
    var addressNumber by remember(safeProfile.id) { mutableStateOf(safeProfile.addressProofNumber) }
    var pendingCategory by remember { mutableStateOf("") }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null && pendingCategory.isNotBlank()) onUpload(pendingCategory, uri)
    }
    val verified = safeProfile.status.equals("verified", true)
    val inReview = safeProfile.status.lowercase() in setOf("pending", "submitted", "under_review", "in_review")
    val normalizedPhone = whatsapp.filter(Char::isDigit).let { raw ->
        when {
            raw.length == 12 && raw.startsWith("91") -> raw.substring(2)
            raw.length == 11 && raw.startsWith("0") -> raw.substring(1)
            else -> raw
        }
    }
    val validPhone = normalizedPhone.matches(Regex("^[6-9]\\d{9}$"))
    val editableDocuments = !verified && !inReview

    Column(Modifier.fillMaxSize().background(AppSurface).safeDrawingPadding().imePadding(), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Ink) }
            Text("Tenant verification", color = Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Surface(shape = RoundedCornerShape(20.dp), color = when { verified -> PaleGreen; inReview -> PaleBlue; else -> Color.White }) {
                Row(Modifier.padding(horizontal = 10.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    if (verified) Icon(Icons.Default.Verified, contentDescription = null, tint = Color(0xFF39805E), modifier = Modifier.size(14.dp))
                    Text(safeProfile.status.replace('_', ' ').replaceFirstChar { it.uppercase() }, color = if (verified) Color(0xFF39805E) else Ink, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
        androidx.compose.foundation.lazy.LazyColumn(
            modifier = Modifier.widthIn(max = 720.dp).fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(15.dp),
        ) {
            item { ScreenHeading(eyebrow = "SAFE, PRIVATE, REVIEWED", title = "Verify your identity", subtitle = "Complete your tenant profile to send rental applications. Your documents are uploaded privately for review.") }
            if (message.isNotBlank()) item { MessageStrip(message, onClearMessage) }
            if (safeProfile.reviewNote.isNotBlank()) {
                item {
                    Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF4E9))) {
                        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Reviewer note", color = Ink, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Text(safeProfile.reviewNote, color = Muted, fontSize = 12.sp, lineHeight = 18.sp)
                        }
                    }
                }
            }
            if (loading) item {
                Row(Modifier.fillMaxWidth().padding(24.dp), horizontalArrangement = Arrangement.Center) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary, strokeWidth = 2.dp)
                }
            }
            item {
                KycSection(title = "Contact for verification", subtitle = "Use an Indian mobile number with WhatsApp.") {
                    KycField(whatsapp, { whatsapp = it.filter { ch -> ch.isDigit() || ch == '+' || ch == ' ' || ch == '-' }.take(16) }, "WhatsApp number", KeyboardType.Phone, enabled = !inReview)
                    if (verified) {
                        Button(
                            onClick = { onUpdateWhatsApp(whatsapp) },
                            enabled = !busy && validPhone,
                            modifier = Modifier.fillMaxWidth().height(46.dp),
                            shape = RoundedCornerShape(13.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Ink),
                        ) { Text("Update WhatsApp number", fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                    }
                }
            }
            item {
                KycSection(title = "Government identity", subtitle = "Upload the front of a valid photo ID. The back is optional.") {
                    DocumentChoices(governmentType, GovernmentIdentityOptions, editableDocuments) { governmentType = it }
                    KycField(governmentNumber, { governmentNumber = it.take(40) }, "Document number", enabled = editableDocuments)
                    UploadRow("Identity front", "tenant_government_identity_front", safeProfile.governmentIdentityFront, busy, editableDocuments, listOf("image/*", "application/pdf"), onPick = { category, types -> pendingCategory = category; picker.launch(types.toTypedArray()) })
                    UploadRow("Identity back (optional)", "tenant_government_identity_back", safeProfile.governmentIdentityBack, busy, editableDocuments, listOf("image/*", "application/pdf"), onPick = { category, types -> pendingCategory = category; picker.launch(types.toTypedArray()) })
                }
            }
            item {
                KycSection(title = "Address proof", subtitle = "Both sides are required when the document has two sides.") {
                    DocumentChoices(addressType, AddressProofOptions, editableDocuments) { addressType = it }
                    KycField(addressNumber, { addressNumber = it.take(40) }, "Document number", enabled = editableDocuments)
                    UploadRow("Address proof front", "tenant_address_proof_front", safeProfile.addressProofFront, busy, editableDocuments, listOf("image/*", "application/pdf"), onPick = { category, types -> pendingCategory = category; picker.launch(types.toTypedArray()) })
                    UploadRow("Address proof back", "tenant_address_proof_back", safeProfile.addressProofBack, busy, editableDocuments, listOf("image/*", "application/pdf"), onPick = { category, types -> pendingCategory = category; picker.launch(types.toTypedArray()) })
                }
            }
            item {
                KycSection(title = "Passport photo", subtitle = "Choose a clear JPG or PNG portrait, up to 2 MB.") {
                    UploadRow("Profile photo", "tenant_passport_photo", safeProfile.passportPhoto, busy, editableDocuments, listOf("image/jpeg", "image/png"), onPick = { category, types -> pendingCategory = category; picker.launch(types.toTypedArray()) })
                }
            }
            item {
                Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = PaleBlue)) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Icon(Icons.Default.Verified, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                        Text("SecureAsset stores verification documents privately and reviews them before enabling tenant applications.", color = Ink, fontSize = 11.sp, lineHeight = 17.sp)
                    }
                }
            }
            item {
                Button(
                    onClick = { onSubmit(whatsapp, governmentType, governmentNumber, addressType, addressNumber) },
                    enabled = !busy && !loading && !verified && !inReview,
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Ink, disabledContainerColor = Accent.copy(alpha = 0.4f)),
                ) {
                    if (busy) CircularProgressIndicator(Modifier.size(18.dp), color = Ink, strokeWidth = 2.dp)
                    else Text(if (verified) "Identity verified" else if (inReview) "Verification in review" else "Submit for verification", fontWeight = FontWeight.Bold)
                }
                if (inReview) Text("Your documents are awaiting review.", color = Muted, fontSize = 11.sp, modifier = Modifier.fillMaxWidth().padding(top = 7.dp))
                Spacer(Modifier.height(20.dp))
            }
        }
    }
}

@Composable
private fun KycSection(title: String, subtitle: String, content: @Composable () -> Unit) {
    Card(shape = RoundedCornerShape(21.dp), colors = CardDefaults.cardColors(containerColor = Color.White), border = androidx.compose.foundation.BorderStroke(1.dp, Border.copy(alpha = 0.65f))) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(title, color = Ink, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                Text(subtitle, color = Muted, fontSize = 11.sp, lineHeight = 16.sp)
            }
            content()
        }
    }
}

@Composable
private fun KycField(value: String, onChange: (String) -> Unit, label: String, keyboardType: KeyboardType = KeyboardType.Text, enabled: Boolean = true) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label, fontSize = 12.sp) },
        modifier = Modifier.fillMaxWidth(),
        enabled = enabled,
        singleLine = true,
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = keyboardType),
        shape = RoundedCornerShape(14.dp),
        colors = OutlinedTextFieldDefaults.colors(unfocusedBorderColor = Border, focusedBorderColor = MaterialTheme.colorScheme.primary, unfocusedContainerColor = Color.White, focusedContainerColor = Color.White),
    )
}

@Composable
private fun DocumentChoices(selected: String, options: List<Pair<String, String>>, enabled: Boolean, onSelect: (String) -> Unit) {
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        options.forEach { (value, label) ->
            FilterChip(selected = selected == value, onClick = { onSelect(value) }, enabled = enabled, label = { Text(label, fontSize = 10.sp) }, shape = RoundedCornerShape(18.dp))
        }
    }
}

@Composable
private fun UploadRow(
    title: String,
    category: String,
    reference: String,
    busy: Boolean,
    enabled: Boolean,
    mimeTypes: List<String>,
    onPick: (String, List<String>) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(PaleBlue).clickable(enabled = !busy && enabled) { onPick(category, mimeTypes) }.padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(Modifier.size(36.dp).clip(CircleShape).background(Color.White), contentAlignment = Alignment.Center) {
            if (reference.isNotBlank()) Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF39805E), modifier = Modifier.size(19.dp))
            else Icon(Icons.Default.CloudUpload, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(19.dp))
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, color = Ink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(if (reference.isNotBlank()) "Added securely · tap to replace" else "Choose a file · max 8 MB", color = Muted, fontSize = 10.sp)
        }
        Text(if (enabled) if (reference.isNotBlank()) "Change" else "Add" else if (reference.isNotBlank()) "Added" else "Unavailable", color = MaterialTheme.colorScheme.primary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}
