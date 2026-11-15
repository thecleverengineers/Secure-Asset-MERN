package in.secureasset.android.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Bed
import androidx.compose.material.icons.filled.Bathtub
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.SquareFoot
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import in.secureasset.android.model.PropertyListing
import in.secureasset.android.model.RentalUnitOption
import in.secureasset.android.model.UserProfile
import in.secureasset.android.ui.components.EmptyState
import in.secureasset.android.ui.components.MessageStrip
import in.secureasset.android.ui.theme.Accent
import in.secureasset.android.ui.theme.Border
import in.secureasset.android.ui.theme.Ink
import in.secureasset.android.ui.theme.Muted
import in.secureasset.android.ui.theme.PaleBlue
import in.secureasset.android.ui.theme.PaleGreen
import in.secureasset.android.ui.theme.Surface
import java.util.Calendar
import java.text.SimpleDateFormat
import java.util.Locale

private const val DETAIL_FALLBACK = "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1500&q=86"

@Composable
fun PropertyDetailScreen(
    listing: PropertyListing,
    user: UserProfile?,
    saved: Boolean,
    loading: Boolean,
    busy: Boolean,
    applyOpen: Boolean,
    message: String,
    onBack: () -> Unit,
    onToggleSaved: () -> Unit,
    onApply: (String?) -> Unit,
    onCloseApplication: () -> Unit,
    onSubmitApplication: (String?, String, String, String, String, String, String, String, String, String, String, Int, String) -> Unit,
    onClearMessage: () -> Unit,
) {
    val context = LocalContext.current
    var selectedUnitId by rememberSaveable(listing.id) { mutableStateOf("") }
    var selectedImage by rememberSaveable(listing.id) { mutableStateOf(0) }
    val selectedUnit = listing.rentalUnits.firstOrNull { it.id == selectedUnitId }
    val address = listing.address.ifBlank { listing.locationLabel }
    Scaffold(
        containerColor = Surface,
        contentWindowInsets = WindowInsets.safeDrawing,
        bottomBar = {
            Surface(shadowElevation = 12.dp, color = Color.White, contentColor = Ink) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(selectedUnit?.let { rupee(it.price) } ?: listing.formattedPrice, color = Ink, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        Text(if (listing.listingType.equals("rent", true)) "per month" else listing.listingType.replaceFirstChar { it.uppercase() }, color = Muted, fontSize = 10.sp)
                    }
                    Button(
                        onClick = { if (listing.listingType.equals("rent", true)) onApply(selectedUnitId.ifBlank { null }) else onToggleSaved() },
                        shape = RoundedCornerShape(15.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Ink),
                        contentPadding = PaddingValues(horizontal = 22.dp, vertical = 14.dp),
                    ) { Text(if (listing.listingType.equals("rent", true)) "Apply now" else if (saved) "Saved" else "Save this home", fontWeight = FontWeight.Bold, fontSize = 13.sp) }
                }
            }
        },
    ) { insets ->
        LazyColumn(
            Modifier.fillMaxSize().padding(insets),
            contentPadding = PaddingValues(bottom = 26.dp),
            verticalArrangement = Arrangement.spacedBy(19.dp),
        ) {
            item {
                Box(Modifier.fillMaxWidth().height(330.dp).background(PaleBlue)) {
                    AsyncImage(
                        model = listing.images.getOrNull(selectedImage) ?: listing.images.firstOrNull() ?: DETAIL_FALLBACK,
                        contentDescription = listing.title,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0x700D2639), Color.Transparent, Color(0x8A0D2639)))))
                    Row(Modifier.align(Alignment.TopStart).fillMaxWidth().padding(horizontal = 16.dp, vertical = 18.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        CircleAction(Icons.Default.ArrowBack, "Back", onBack)
                        Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                            CircleAction(Icons.Default.Share, "Share property") {
                                val share = Intent(Intent.ACTION_SEND).apply {
                                    type = "text/plain"
                                    putExtra(Intent.EXTRA_TEXT, "${listing.title} · ${listing.locationLabel}\nhttps://secureasset.in/property/${listing.slug.ifBlank { listing.id }}")
                                }
                                runCatching { context.startActivity(Intent.createChooser(share, "Share this home")) }
                            }
                            CircleAction(if (saved) Icons.Default.Favorite else Icons.Default.FavoriteBorder, if (saved) "Remove saved" else "Save property", onToggleSaved, tint = if (saved) Color(0xFFB85A53) else Ink)
                        }
                    }
                    Surface(Modifier.align(Alignment.BottomEnd).padding(15.dp), shape = RoundedCornerShape(20.dp), color = Color.Black.copy(alpha = 0.5f)) {
                        Text("${selectedImage + 1} / ${listing.images.size.coerceAtLeast(1)}", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 11.dp, vertical = 7.dp))
                    }
                    if (listing.images.size > 1) {
                        Row(Modifier.align(Alignment.BottomCenter).padding(bottom = 15.dp), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                            listing.images.take(5).forEachIndexed { index, _ ->
                                Box(Modifier.size(if (index == selectedImage) 17.dp else 6.dp, 6.dp).clip(CircleShape).background(if (index == selectedImage) Accent else Color.White.copy(alpha = 0.72f)).clickable { selectedImage = index })
                            }
                        }
                    }
                }
            }
            item {
                Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                        Tag(text = listing.listingType.replace('_', ' ').replaceFirstChar { it.uppercase() })
                        if (listing.isVerified) {
                            Surface(shape = RoundedCornerShape(20.dp), color = PaleGreen) {
                                Row(Modifier.padding(horizontal = 9.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Icon(Icons.Default.Verified, contentDescription = null, tint = Color(0xFF35805A), modifier = Modifier.size(13.dp))
                                    Text("Verified", color = Color(0xFF35805A), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                        if (loading) CircularProgressIndicator(Modifier.size(15.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.primary)
                    }
                    Text(listing.title, color = Ink, fontSize = 25.sp, lineHeight = 30.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.4).sp)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        Icon(Icons.Default.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(17.dp))
                        Text(address, color = Muted, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
            item {
                Row(Modifier.padding(horizontal = 20.dp).fillMaxWidth().clip(RoundedCornerShape(19.dp)).background(Color.White).padding(vertical = 15.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                    FeatureCell(Icons.Default.Bed, listing.bedrooms.ifBlank { "—" }, "Bedrooms")
                    FeatureCell(Icons.Default.Bathtub, listing.bathrooms.ifBlank { "—" }, "Bathrooms")
                    FeatureCell(Icons.Default.SquareFoot, if (listing.area > 0) "${listing.area.toInt()}" else "—", listing.areaUnit)
                }
            }
            if (listing.rentalUnits.isNotEmpty()) {
                item {
                    Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Available rooms", color = Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        Text("Choose the room you want to apply for.", color = Muted, fontSize = 12.sp)
                        listing.rentalUnits.forEach { unit ->
                            val canApply = unit.status.equals("AVAILABLE", true) || unit.status.equals("APPLICATION_PENDING", true)
                            UnitCard(unit, selected = unit.id == selectedUnitId, enabled = canApply, onClick = { if (canApply) selectedUnitId = unit.id })
                        }
                    }
                }
            }
            if (message.isNotBlank()) item { MessageStrip(message, onClearMessage, Modifier.padding(horizontal = 20.dp)) }
            item {
                Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Text("A little about this home", color = Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Text(listing.description.ifBlank { "A thoughtfully presented ${listing.type.lowercase()} in ${listing.locationLabel}. Contact SecureAsset to learn more about availability and property details." }, color = Muted, fontSize = 13.sp, lineHeight = 20.sp)
                }
            }
            if (listing.amenities.isNotEmpty()) {
                item {
                    Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Amenities", color = Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listing.amenities.take(6).forEach { amenity -> Tag(amenity.replace('_', ' ')) }
                        }
                    }
                }
            }
            item {
                Card(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = Color.White), border = androidx.compose.foundation.BorderStroke(1.dp, Border.copy(alpha = 0.6f))) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(Modifier.size(43.dp).clip(CircleShape).background(PaleBlue), contentAlignment = Alignment.Center) { Icon(Icons.Default.Home, contentDescription = null, tint = MaterialTheme.colorScheme.primary) }
                        Column(Modifier.weight(1f)) {
                            Text(listing.ownerName.ifBlank { "SecureAsset verified owner" }, color = Ink, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            Text(if (listing.ownerVerified) "Identity checked by SecureAsset" else "Property contact through SecureAsset", color = Muted, fontSize = 11.sp)
                        }
                        if (listing.ownerVerified) Icon(Icons.Default.Verified, contentDescription = "Verified owner", tint = Color(0xFF39815E), modifier = Modifier.size(20.dp))
                    }
                }
            }
            item {
                Column(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Text("Around this home", color = Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(PaleBlue).clickable {
                        val uri = Uri.parse("geo:0,0?q=${Uri.encode(address)}")
                        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                    }.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Icon(Icons.Default.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Column(Modifier.weight(1f)) {
                            Text(listing.locationLabel, color = Ink, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                            Text("Open location in Maps", color = Muted, fontSize = 11.sp)
                        }
                        Text("↗", color = MaterialTheme.colorScheme.primary, fontSize = 20.sp)
                    }
                }
            }
        }
    }

    if (applyOpen) {
        ApplicationSheet(
            listing = listing,
            selectedUnit = selectedUnit,
            user = user,
            busy = busy,
            onDismiss = onCloseApplication,
            onSubmit = onSubmitApplication,
        )
    }
}

@Composable
private fun CircleAction(icon: androidx.compose.ui.graphics.vector.ImageVector, description: String, onClick: () -> Unit, tint: Color = Ink) {
    IconButton(onClick = onClick, modifier = Modifier.size(42.dp).background(Color.White.copy(alpha = 0.94f), CircleShape)) {
        Icon(icon, contentDescription = description, tint = tint, modifier = Modifier.size(19.dp))
    }
}

@Composable
private fun Tag(text: String) {
    Surface(shape = RoundedCornerShape(18.dp), color = PaleGreen) {
        Text(text.replaceFirstChar { it.uppercase() }, color = Color(0xFF376B4A), fontSize = 10.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp))
    }
}

@Composable
private fun FeatureCell(icon: androidx.compose.ui.graphics.vector.ImageVector, value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(19.dp))
        Text(value, color = Ink, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        Text(label, color = Muted, fontSize = 10.sp)
    }
}

@Composable
private fun UnitCard(unit: RentalUnitOption, selected: Boolean, enabled: Boolean, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(enabled = enabled, onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = if (selected) PaleGreen else Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, if (selected) Accent else Border),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
            Column(Modifier.weight(1f)) {
                Text(unit.name, color = Ink, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                Text(listOf(unit.floor, if (unit.area > 0) "${unit.area.toInt()} ${unit.areaUnit}" else "").filter(String::isNotBlank).joinToString(" · ").ifBlank { unit.status.replace('_', ' ') }, color = Muted, fontSize = 10.sp)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(rupee(unit.price), color = Ink, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                Text(if (enabled) "Available" else "Unavailable", color = if (enabled) Color(0xFF44845C) else Muted, fontSize = 10.sp)
            }
        }
    }
}

@Composable
private fun ApplicationSheet(
    listing: PropertyListing,
    selectedUnit: RentalUnitOption?,
    user: UserProfile?,
    busy: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (String?, String, String, String, String, String, String, String, String, String, String, Int, String) -> Unit,
) {
    var fullName by remember { mutableStateOf(user?.name.orEmpty()) }
    var phone by remember { mutableStateOf(user?.phone.orEmpty()) }
    var email by remember { mutableStateOf(user?.email.orEmpty()) }
    var occupation by remember { mutableStateOf("") }
    var employer by remember { mutableStateOf("") }
    var income by remember { mutableStateOf("") }
    var identityType by remember { mutableStateOf("") }
    var idNumber by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var moveIn by remember { mutableStateOf(Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, 7) }.time.let { SimpleDateFormat("yyyy-MM-dd", Locale.US).format(it) }) }
    var stayMonths by remember { mutableStateOf("12") }
    var message by remember { mutableStateOf("") }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = Color.White) {
        LazyColumn(
            Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 22.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Request this home", color = Ink, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    Text("Share a few details with the property owner. Verified tenant KYC is required to submit.", color = Muted, fontSize = 12.sp, lineHeight = 18.sp)
                    Text(listing.title + (selectedUnit?.let { " · ${it.name}" } ?: ""), color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 3.dp))
                }
            }
            item { ApplyField(fullName, { fullName = it }, "Full name") }
            item { ApplyField(phone, { phone = it }, "Phone number", KeyboardType.Phone) }
            item { ApplyField(email, { email = it }, "Email address", KeyboardType.Email) }
            item { ApplyField(occupation, { occupation = it }, "Occupation") }
            item { ApplyField(employer, { employer = it }, "Employer or organization") }
            item { ApplyField(income, { income = it.filter { ch -> ch.isDigit() || ch == '.' } }, "Monthly income (₹)", KeyboardType.Decimal) }
            item { ApplyField(identityType, { identityType = it }, "Government ID type") }
            item { ApplyField(idNumber, { idNumber = it }, "Government ID number") }
            item { ApplyField(address, { address = it }, "Current address") }
            item { ApplyField(moveIn, { moveIn = it }, "Preferred move-in date (YYYY-MM-DD)") }
            item { ApplyField(stayMonths, { stayMonths = it.filter(Char::isDigit) }, "Expected stay in months", KeyboardType.Number) }
            item { ApplyField(message, { message = it }, "Message to the owner", singleLine = false) }
            item {
                Button(
                    onClick = { onSubmit(selectedUnit?.id, fullName, phone, email, occupation, employer, income, identityType, idNumber, address, moveIn, stayMonths.toIntOrNull() ?: 12, message) },
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(15.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Ink),
                ) {
                    if (busy) CircularProgressIndicator(Modifier.size(18.dp), color = Ink, strokeWidth = 2.dp)
                    else Text("Submit application", fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun ApplyField(
    value: String,
    onChange: (String) -> Unit,
    label: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    singleLine: Boolean = true,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label, fontSize = 12.sp) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = singleLine,
        minLines = if (singleLine) 1 else 3,
        shape = RoundedCornerShape(14.dp),
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        colors = OutlinedTextFieldDefaults.colors(unfocusedBorderColor = Border, focusedBorderColor = MaterialTheme.colorScheme.primary, unfocusedContainerColor = Color.White, focusedContainerColor = Color.White),
    )
}

private fun rupee(amount: Double): String = java.text.NumberFormat.getCurrencyInstance(java.util.Locale("en", "IN")).apply { maximumFractionDigits = 0 }.format(amount)
