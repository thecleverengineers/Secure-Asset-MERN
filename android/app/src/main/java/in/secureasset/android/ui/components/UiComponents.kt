package in.secureasset.android.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import in.secureasset.android.model.PropertyListing
import in.secureasset.android.ui.theme.Accent
import in.secureasset.android.ui.theme.Border
import in.secureasset.android.ui.theme.Blue
import in.secureasset.android.ui.theme.Ink
import in.secureasset.android.ui.theme.Muted
import in.secureasset.android.ui.theme.PaleBlue
import in.secureasset.android.ui.theme.PaleGreen

private const val FALLBACK_HOME_PHOTO = "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=82"

@Composable
fun SecureAssetMark(modifier: Modifier = Modifier) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        Box(
            modifier = Modifier
                .size(35.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Ink),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Default.Home, contentDescription = null, tint = Accent, modifier = Modifier.size(19.dp))
        }
        Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
            Text("SECUREASSET", color = Ink, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.4.sp)
            Text("PROPERTY, HELD WITH CARE", color = Muted, fontSize = 8.sp, fontWeight = FontWeight.Medium, letterSpacing = 1.1.sp)
        }
    }
}

@Composable
fun ScreenHeading(
    eyebrow: String? = null,
    title: String,
    subtitle: String? = null,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (!eyebrow.isNullOrBlank()) Text(eyebrow.uppercase(), color = MaterialTheme.colorScheme.primary, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.4.sp)
        Text(title, color = Ink, fontSize = 25.sp, lineHeight = 30.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.4).sp)
        if (!subtitle.isNullOrBlank()) Text(subtitle, color = Muted, fontSize = 13.sp, lineHeight = 19.sp)
    }
}

@Composable
fun SectionTitle(title: String, action: String? = null, onAction: (() -> Unit)? = null) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(title, color = Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        if (!action.isNullOrBlank() && onAction != null) {
            Text(action, color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.clickable(onClick = onAction).padding(5.dp))
        }
    }
}

@Composable
fun PropertyCard(
    listing: PropertyListing,
    saved: Boolean,
    onClick: () -> Unit,
    onToggleSaved: () -> Unit,
    modifier: Modifier = Modifier,
    imageHeight: Int = 185,
) {
    Card(
        onClick = onClick,
        modifier = modifier.shadow(2.dp, RoundedCornerShape(22.dp)),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = BorderStroke(1.dp, Border.copy(alpha = 0.55f)),
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(imageHeight.dp)
                    .background(PaleBlue),
            ) {
                AsyncImage(
                    model = listing.images.firstOrNull() ?: FALLBACK_HOME_PHOTO,
                    contentDescription = listing.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxWidth().height(imageHeight.dp),
                )
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .height(74.dp)
                        .background(Brush.verticalGradient(listOf(Color.Transparent, Color(0xAA0E2535)))),
                )
                if (listing.isFeatured || listing.isVerified) {
                    Surface(
                        modifier = Modifier.align(Alignment.TopStart).padding(12.dp),
                        shape = RoundedCornerShape(30.dp),
                        color = Color.White.copy(alpha = 0.96f),
                        shadowElevation = 2.dp,
                    ) {
                        Row(Modifier.padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                            Icon(if (listing.isVerified) Icons.Default.Verified else Icons.Default.Star, contentDescription = null, tint = if (listing.isVerified) MaterialTheme.colorScheme.primary else Color(0xFFC59B54), modifier = Modifier.size(13.dp))
                            Text(if (listing.isVerified) "Verified" else "Featured", color = Ink, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
                IconButton(
                    onClick = onToggleSaved,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(9.dp)
                        .size(37.dp)
                        .background(Color.White.copy(alpha = 0.96f), CircleShape),
                ) {
                    Icon(if (saved) Icons.Default.Favorite else Icons.Default.FavoriteBorder, contentDescription = if (saved) "Remove from saved" else "Save property", tint = if (saved) Color(0xFFB85A53) else Ink, modifier = Modifier.size(18.dp))
                }
                Text(
                    listing.locationLabel,
                    color = Color.White,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.align(Alignment.BottomStart).padding(start = 14.dp, bottom = 12.dp, end = 14.dp),
                )
            }
            Column(Modifier.fillMaxWidth().padding(horizontal = 15.dp, vertical = 14.dp)) {
                Text(listing.title, color = Ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(4.dp))
                Text(listing.type.ifBlank { "Residential property" }, color = Muted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(11.dp))
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(listing.formattedPrice, color = Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                        if (listing.priceSuffix.isNotBlank()) Text(listing.priceSuffix, color = Muted, fontSize = 10.sp, modifier = Modifier.padding(bottom = 2.dp))
                    }
                    if (listing.area > 0) Text("${listing.area.toInt()} ${listing.areaUnit}", color = Muted, fontSize = 10.sp, modifier = Modifier.padding(bottom = 2.dp))
                }
            }
        }
    }
}

@Composable
fun QuietTag(text: String, modifier: Modifier = Modifier) {
    AssistChip(
        onClick = {},
        label = { Text(text, fontSize = 10.sp, fontWeight = FontWeight.Medium) },
        modifier = modifier.height(30.dp),
        shape = RoundedCornerShape(18.dp),
        colors = AssistChipDefaults.assistChipColors(containerColor = PaleGreen, labelColor = Color(0xFF376B4A)),
        border = null,
    )
}

@Composable
fun EmptyState(title: String, body: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth().padding(vertical = 44.dp, horizontal = 22.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(Modifier.size(58.dp).clip(CircleShape).background(PaleBlue), contentAlignment = Alignment.Center) {
            Icon(Icons.Default.Home, contentDescription = null, tint = Blue, modifier = Modifier.size(26.dp))
        }
        Text(title, color = Ink, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        Text(body, color = Muted, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.width(270.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
    }
}

@Composable
fun MessageStrip(message: String, onDismiss: () -> Unit = {}, modifier: Modifier = Modifier) {
    if (message.isBlank()) return
    Row(
        modifier = modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(PaleBlue).padding(horizontal = 14.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(message, color = Ink, fontSize = 12.sp, lineHeight = 17.sp, modifier = Modifier.weight(1f))
        Spacer(Modifier.width(8.dp))
        Text("×", color = Muted, fontSize = 18.sp, modifier = Modifier.clickable(onClick = onDismiss).padding(horizontal = 4.dp))
    }
}
