package in.secureasset.android.ui.screens

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import androidx.compose.ui.layout.ContentScale
import in.secureasset.android.model.PropertyListing
import in.secureasset.android.model.UserProfile
import in.secureasset.android.ui.components.EmptyState
import in.secureasset.android.ui.components.MessageStrip
import in.secureasset.android.ui.components.PropertyCard
import in.secureasset.android.ui.components.ScreenHeading
import in.secureasset.android.ui.components.SecureAssetMark
import in.secureasset.android.ui.components.SectionTitle
import in.secureasset.android.ui.theme.Accent
import in.secureasset.android.ui.theme.Border
import in.secureasset.android.ui.theme.Ink
import in.secureasset.android.ui.theme.Muted
import in.secureasset.android.ui.theme.PaleBlue
import in.secureasset.android.ui.theme.Surface

private const val FEATURED_HOME_PHOTO = "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=84"

@Composable
fun HomeScreen(
    user: UserProfile?,
    properties: List<PropertyListing>,
    savedIds: Set<String>,
    loading: Boolean,
    message: String,
    onSearch: (String) -> Unit,
    onOpenExplore: () -> Unit,
    onOpenSaved: () -> Unit,
    onOpenActivity: () -> Unit,
    onSelectListingType: (String) -> Unit,
    onOpenProperty: (PropertyListing) -> Unit,
    onToggleSaved: (PropertyListing) -> Unit,
    onClearMessage: () -> Unit,
) {
    var search by remember { mutableStateOf("") }
    var listingType by remember { mutableStateOf("rent") }
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(Surface),
        contentPadding = PaddingValues(bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(22.dp),
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp).padding(top = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                SecureAssetMark()
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onOpenSaved) { Text("♡", fontSize = 24.sp, color = Ink) }
                    IconButton(onClick = onOpenActivity) {
                        Icon(Icons.Default.NotificationsNone, contentDescription = "Notifications", tint = Ink)
                    }
                }
            }
        }
        item {
            Column(Modifier.padding(horizontal = 22.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                ScreenHeading(
                    eyebrow = "YOUR SPACE, REIMAGINED",
                    title = if (user != null) "Good morning, ${user.firstName}." else "Find your place.",
                    subtitle = "A considered home is closer than you think.",
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("rent" to "Rent", "sale" to "Buy", "lease" to "Lease").forEach { (key, label) ->
                        FilterChip(
                            selected = listingType == key,
                            onClick = { listingType = key; onSelectListingType(key) },
                            label = { Text(label, fontSize = 12.sp, fontWeight = if (listingType == key) FontWeight.Bold else FontWeight.Medium) },
                            shape = RoundedCornerShape(18.dp),
                            border = if (listingType == key) null else FilterChipDefaults.filterChipBorder(enabled = true, selected = false, borderColor = Border),
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Ink, selectedLabelColor = Color.White, containerColor = Color.White, labelColor = Muted),
                        )
                    }
                }
                OutlinedTextField(
                    value = search,
                    onValueChange = { search = it },
                    modifier = Modifier.fillMaxWidth().clickable { onOpenExplore() },
                    placeholder = { Text("Search by neighbourhood or property", fontSize = 12.sp) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
                    trailingIcon = { Text("Explore", color = MaterialTheme.colorScheme.primary, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { onSearch(search); onOpenExplore() }.padding(end = 14.dp)) },
                    singleLine = true,
                    shape = RoundedCornerShape(17.dp),
                    colors = OutlinedTextFieldDefaults.colors(unfocusedBorderColor = Border, focusedBorderColor = MaterialTheme.colorScheme.primary, unfocusedContainerColor = Color.White, focusedContainerColor = Color.White),
                )
                MessageStrip(message, onClearMessage)
            }
        }
        item {
            Card(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp).height(192.dp).clickable { onOpenExplore() },
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Ink),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
            ) {
                Box(Modifier.fillMaxSize()) {
                    AsyncImage(FEATURED_HOME_PHOTO, contentDescription = "Modern living space", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                    Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(Color(0xE60F2C40), Color(0x29112B3F)))))
                    Column(Modifier.align(Alignment.CenterStart).padding(22.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("A BETTER WAY TO MOVE", color = Accent, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.5.sp)
                        Text("Homes that fit\nyour next chapter.", color = Color.White, fontSize = 24.sp, lineHeight = 29.sp, fontWeight = FontWeight.Bold)
                        Text("Thoughtful spaces. Secure decisions.", color = Color.White.copy(alpha = 0.86f), fontSize = 11.sp)
                    }
                    Box(Modifier.align(Alignment.BottomEnd).padding(18.dp).size(42.dp).clip(CircleShape).background(Accent), contentAlignment = Alignment.Center) {
                        Text("↗", color = Ink, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        item {
            Column {
                Row(Modifier.padding(horizontal = 22.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text("CURATED FOR YOU", color = MaterialTheme.colorScheme.primary, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.4.sp)
                        SectionTitle("Featured homes", "View all", onOpenExplore)
                    }
                }
                if (loading && properties.isEmpty()) {
                    Box(Modifier.fillMaxWidth().height(190.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = MaterialTheme.colorScheme.primary, strokeWidth = 2.dp, modifier = Modifier.size(24.dp)) }
                } else if (properties.isEmpty()) {
                    EmptyState("New homes are on the way", "Try another category or explore a different area.", Modifier.padding(horizontal = 18.dp))
                } else {
                    LazyRow(contentPadding = PaddingValues(horizontal = 22.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        items(properties.take(10), key = { "home-${it.id}" }) { listing ->
                            PropertyCard(
                                listing = listing,
                                saved = savedIds.contains(listing.id),
                                onClick = { onOpenProperty(listing) },
                                onToggleSaved = { onToggleSaved(listing) },
                                modifier = Modifier.width(292.dp),
                                imageHeight = 158,
                            )
                        }
                    }
                }
            }
        }
        item {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 22.dp).clip(RoundedCornerShape(21.dp)).background(Color.White).padding(17.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(44.dp).clip(RoundedCornerShape(15.dp)).background(PaleBlue), contentAlignment = Alignment.Center) {
                    Text("✦", color = MaterialTheme.colorScheme.primary, fontSize = 22.sp)
                }
                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                    Text("Move with confidence", color = Ink, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text("Secure listings, clear details, and support at every step.", color = Muted, fontSize = 11.sp, lineHeight = 16.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                Spacer(Modifier.width(8.dp))
            }
        }
    }
}
