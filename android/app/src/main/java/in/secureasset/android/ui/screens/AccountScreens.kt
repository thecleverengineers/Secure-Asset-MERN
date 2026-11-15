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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import in.secureasset.android.model.ActivityRecord
import in.secureasset.android.model.PropertyListing
import in.secureasset.android.model.UserProfile
import in.secureasset.android.ui.components.EmptyState
import in.secureasset.android.ui.components.MessageStrip
import in.secureasset.android.ui.components.PropertyCard
import in.secureasset.android.ui.components.ScreenHeading
import in.secureasset.android.ui.components.SecureAssetMark
import in.secureasset.android.ui.theme.Accent
import in.secureasset.android.ui.theme.Border
import in.secureasset.android.ui.theme.Ink
import in.secureasset.android.ui.theme.Muted
import in.secureasset.android.ui.theme.PaleBlue
import in.secureasset.android.ui.theme.PaleGreen
import in.secureasset.android.ui.theme.Surface
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun SavedScreen(
    listings: List<PropertyListing>,
    loading: Boolean,
    signedIn: Boolean,
    onSignIn: () -> Unit,
    onOpenProperty: (PropertyListing) -> Unit,
    onRemove: (PropertyListing) -> Unit,
    onExplore: () -> Unit,
    message: String,
    onClearMessage: () -> Unit,
) {
    LazyColumn(Modifier.fillMaxSize().background(Surface), contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
        item { ScreenHeading(eyebrow = "YOUR COLLECTION", title = "Saved homes", subtitle = "The places you want to come back to.") }
        if (message.isNotBlank()) item { MessageStrip(message, onClearMessage) }
        if (listings.isEmpty() && !loading) item {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                EmptyState(
                    if (signedIn) "Your shortlist starts here" else "Sign in to see saved homes",
                    if (signedIn) "Save a home you love and it will be waiting for you here." else "Your shortlist stays synced to your SecureAsset account.",
                )
                Button(onClick = if (signedIn) onExplore else onSignIn, shape = RoundedCornerShape(15.dp), colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Ink)) {
                    Text(if (signedIn) "Explore homes" else "Sign in securely", fontWeight = FontWeight.Bold)
                }
            }
        }
        items(listings, key = { "saved-${it.id}" }) { listing ->
            PropertyCard(listing, saved = true, onClick = { onOpenProperty(listing) }, onToggleSaved = { onRemove(listing) }, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
fun ActivityScreen(
    applications: List<ActivityRecord>,
    notifications: List<ActivityRecord>,
    loading: Boolean,
    signedIn: Boolean,
    onSignIn: () -> Unit,
    onMarkRead: (ActivityRecord) -> Unit,
    message: String,
    onClearMessage: () -> Unit,
) {
    var selected by remember { mutableStateOf("Updates") }
    val rows = if (selected == "Applications") applications else notifications
    LazyColumn(Modifier.fillMaxSize().background(Surface), contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
        item { ScreenHeading(eyebrow = "STAY IN THE KNOW", title = "Activity", subtitle = "Applications and important account updates.") }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Updates", "Applications").forEach { label ->
                    FilterChip(
                        selected = selected == label,
                        onClick = { selected = label },
                        label = { Text(label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold) },
                        shape = RoundedCornerShape(18.dp),
                        border = if (selected == label) null else FilterChipDefaults.filterChipBorder(enabled = true, selected = false, borderColor = Border),
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Ink, selectedLabelColor = Color.White, containerColor = Color.White, labelColor = Muted),
                    )
                }
            }
        }
        if (message.isNotBlank()) item { MessageStrip(message, onClearMessage) }
        if (rows.isEmpty() && !loading) {
            item {
                EmptyState(
                    when {
                        !signedIn -> "Sign in to view activity"
                        selected == "Applications" -> "No applications yet"
                        else -> "You’re all caught up"
                    },
                    when {
                        !signedIn -> "Application progress and account updates are private to your account."
                        selected == "Applications" -> "Your rental requests and their progress will appear here."
                        else -> "New messages and account updates will appear here."
                    },
                )
            }
            if (!signedIn) item {
                Button(onClick = onSignIn, shape = RoundedCornerShape(15.dp), colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Ink)) {
                    Text("Sign in securely", fontWeight = FontWeight.Bold)
                }
            }
        }
        items(rows, key = { "${selected}-${it.id}" }) { item ->
            ActivityCard(item, isApplication = selected == "Applications", onClick = { onMarkRead(item) })
        }
    }
}

@Composable
private fun ActivityCard(item: ActivityRecord, isApplication: Boolean, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, Border.copy(alpha = 0.6f)),
    ) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(13.dp)) {
            Box(Modifier.size(42.dp).clip(RoundedCornerShape(14.dp)).background(if (isApplication) PaleGreen else PaleBlue), contentAlignment = Alignment.Center) {
                Icon(if (isApplication) Icons.Default.Home else Icons.Default.Notifications, contentDescription = null, tint = if (isApplication) Color(0xFF39815E) else MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(item.title, color = Ink, fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text(item.message.ifBlank { item.category.replace('_', ' ').replaceFirstChar { it.uppercase() } }, color = Muted, fontSize = 12.sp, lineHeight = 17.sp)
                Text(formatDate(item.date), color = Muted.copy(alpha = 0.85f), fontSize = 10.sp)
            }
            if (!isApplication && !item.read) Box(Modifier.padding(top = 5.dp).size(8.dp).clip(CircleShape).background(Accent))
        }
    }
}

@Composable
fun GuestProfileScreen(onSignIn: () -> Unit, onCreateAccount: () -> Unit) {
    Column(
        Modifier.fillMaxSize().background(Surface).padding(horizontal = 20.dp, vertical = 22.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
    ) {
        ScreenHeading(eyebrow = "YOUR SECURE ACCOUNT", title = "Welcome to SecureAsset", subtitle = "Sign in to save homes, manage applications, and keep your next move in one place.")
        Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = Ink)) {
            Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Icon(Icons.Default.Verified, contentDescription = null, tint = Accent, modifier = Modifier.size(27.dp))
                Text("A more considered way to find home.", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Text("Browse available homes as a guest. Create a tenant account when you’re ready to shortlist or apply.", color = Color.White.copy(alpha = 0.82f), fontSize = 12.sp, lineHeight = 18.sp)
            }
        }
        Button(onClick = onSignIn, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(15.dp), colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Ink)) {
            Text("Sign in securely", fontWeight = FontWeight.Bold)
        }
        OutlinedButton(onClick = onCreateAccount, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(15.dp), border = androidx.compose.foundation.BorderStroke(1.dp, Border)) {
            Text("Create your account", fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
fun ProfileScreen(
    user: UserProfile,
    savedCount: Int,
    ownedProperties: List<PropertyListing>,
    ownedLoading: Boolean,
    message: String,
    onSignOut: () -> Unit,
    onClearMessage: () -> Unit,
    onOpenOwnedListing: (PropertyListing) -> Unit,
    onOpenKyc: () -> Unit,
) {
    val context = LocalContext.current
    LazyColumn(Modifier.fillMaxSize().background(Surface), contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
        item { ScreenHeading(eyebrow = "YOUR SECURE ACCOUNT", title = "Profile", subtitle = "Your information and account access.") }
        if (message.isNotBlank()) item { MessageStrip(message, onClearMessage) }
        item {
            Card(shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = Ink)) {
                Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Box(Modifier.size(62.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
                        if (user.avatar.isNotBlank()) AsyncImage(user.avatar, contentDescription = "Profile photo", modifier = Modifier.fillMaxSize(), contentScale = androidx.compose.ui.layout.ContentScale.Crop)
                        else Icon(Icons.Default.AccountCircle, contentDescription = null, tint = Accent, modifier = Modifier.size(38.dp))
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(user.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(user.email.ifBlank { user.phone }, color = Color.White.copy(alpha = 0.78f), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(user.role.replace('_', ' ').replaceFirstChar { it.uppercase() }, color = Accent, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.6.sp)
                    }
                }
            }
        }
        item {
            Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = Color.White), border = androidx.compose.foundation.BorderStroke(1.dp, Border.copy(alpha = 0.6f))) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    InfoRow(Icons.Default.Email, user.email.ifBlank { "Email not added" }, "Email address")
                    InfoRow(Icons.Default.Phone, user.phone.ifBlank { "Phone not added" }, "Phone number")
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Icon(if (user.kycStatus.equals("verified", true)) Icons.Default.Verified else Icons.Default.CheckCircle, contentDescription = null, tint = if (user.kycStatus.equals("verified", true)) Color(0xFF3D8A62) else Muted, modifier = Modifier.size(19.dp))
                        Column {
                            Text("Tenant verification", color = Ink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                            Text(user.kycStatus.replace('_', ' ').replaceFirstChar { it.uppercase() }, color = Muted, fontSize = 11.sp)
                        }
                    }
                    if (user.isTenant) {
                        val pending = user.kycStatus.lowercase() in setOf("pending", "submitted", "under_review", "in_review")
                        Button(
                            onClick = onOpenKyc,
                            modifier = Modifier.fillMaxWidth().height(45.dp),
                            shape = RoundedCornerShape(13.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Ink),
                        ) {
                            Text(
                                when {
                                    user.kycStatus.equals("verified", true) -> "Manage verification and WhatsApp"
                                    pending -> "View verification"
                                    else -> "Complete tenant verification"
                                },
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                SummaryTile("Saved homes", savedCount.toString(), Modifier.weight(1f))
                SummaryTile("Account", if (user.kycStatus.equals("verified", true)) "Verified" else "Active", Modifier.weight(1f))
            }
        }
        if (user.hasLandlordMode) {
            item { Text("Your properties", color = Ink, fontWeight = FontWeight.Bold, fontSize = 17.sp, modifier = Modifier.padding(top = 5.dp)) }
            if (ownedProperties.isEmpty() && !ownedLoading) item { Text("Your published and private listings will appear here.", color = Muted, fontSize = 12.sp) }
            items(ownedProperties, key = { "owned-${it.id}" }) { listing ->
                Card(
                    modifier = Modifier.fillMaxWidth().clickable { onOpenOwnedListing(listing) },
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Border.copy(alpha = 0.6f)),
                ) {
                    Row(Modifier.padding(15.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                        Box(Modifier.size(44.dp).clip(RoundedCornerShape(13.dp)).background(PaleBlue), contentAlignment = Alignment.Center) { Icon(Icons.Default.Home, contentDescription = null, tint = MaterialTheme.colorScheme.primary) }
                        Column(Modifier.weight(1f)) {
                            Text(listing.title, color = Ink, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(listing.locationLabel, color = Muted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        Text(listing.formattedPrice, color = Ink, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        item {
            OutlinedButton(
                onClick = onSignOut,
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = RoundedCornerShape(15.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Border),
            ) {
                Icon(Icons.Default.Logout, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(8.dp))
                Text("Sign out", fontWeight = FontWeight.SemiBold)
            }
        }
        item {
            Text(
                "Need help? Contact SecureAsset support",
                color = MaterialTheme.colorScheme.primary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.fillMaxWidth().clickable {
                    val intent = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:support@secureasset.in"))
                    runCatching { context.startActivity(intent) }
                }.padding(vertical = 10.dp),
            )
        }
    }
}

@Composable
private fun SummaryTile(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier.clip(RoundedCornerShape(18.dp)).background(Color.White).padding(15.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, color = Muted, fontSize = 11.sp)
        Text(value, color = Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun InfoRow(icon: androidx.compose.ui.graphics.vector.ImageVector, value: String, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(19.dp))
        Column {
            Text(label, color = Muted, fontSize = 10.sp)
            Text(value, color = Ink, fontWeight = FontWeight.Medium, fontSize = 12.sp)
        }
    }
}

private fun formatDate(raw: String): String {
    if (raw.isBlank()) return ""
    return runCatching {
        val parsed = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssX", Locale.US).parse(raw) ?: return raw.take(10)
        SimpleDateFormat("d MMM yyyy · h:mm a", Locale.getDefault()).format(parsed)
    }.getOrElse { raw.take(10) }
}
