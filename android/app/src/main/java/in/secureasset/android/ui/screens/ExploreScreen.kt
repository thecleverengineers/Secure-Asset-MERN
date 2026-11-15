package in.secureasset.android.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import in.secureasset.android.model.PropertyListing
import in.secureasset.android.ui.components.EmptyState
import in.secureasset.android.ui.components.MessageStrip
import in.secureasset.android.ui.components.PropertyCard
import in.secureasset.android.ui.components.ScreenHeading
import in.secureasset.android.ui.theme.Accent
import in.secureasset.android.ui.theme.Border
import in.secureasset.android.ui.theme.Ink
import in.secureasset.android.ui.theme.Muted
import in.secureasset.android.ui.theme.Surface

@Composable
fun ExploreScreen(
    properties: List<PropertyListing>,
    savedIds: Set<String>,
    loading: Boolean,
    query: String,
    city: String,
    listingType: String,
    minPrice: String,
    maxPrice: String,
    message: String,
    onQueryChange: (String) -> Unit,
    onCityChange: (String) -> Unit,
    onTypeChange: (String) -> Unit,
    onPriceChange: (String, String) -> Unit,
    onSearch: () -> Unit,
    onOpenProperty: (PropertyListing) -> Unit,
    onToggleSaved: (PropertyListing) -> Unit,
    onClearMessage: () -> Unit,
) {
    var filtersOpen by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().background(Surface)) {
        Column(Modifier.padding(horizontal = 22.dp).padding(top = 18.dp, bottom = 15.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            ScreenHeading(eyebrow = "THE MARKETPLACE", title = "Explore homes", subtitle = "Find a place that feels right, in an area you love.")
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("Location, property or landmark", fontSize = 12.sp) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
                    trailingIcon = { IconButton(onClick = onSearch) { Icon(Icons.Default.Search, contentDescription = "Search") } },
                    singleLine = true,
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(unfocusedBorderColor = Border, focusedBorderColor = MaterialTheme.colorScheme.primary, unfocusedContainerColor = Color.White, focusedContainerColor = Color.White),
                )
                IconButton(onClick = { filtersOpen = true }, modifier = Modifier.size(54.dp).background(Ink, RoundedCornerShape(16.dp))) {
                    Icon(Icons.Default.Tune, contentDescription = "Filters", tint = Color.White)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                listOf("rent" to "Rent", "sale" to "Buy", "lease" to "Lease").forEach { (key, label) ->
                    FilterChip(
                        selected = listingType == key,
                        onClick = { onTypeChange(key); onSearch() },
                        label = { Text(label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold) },
                        shape = RoundedCornerShape(18.dp),
                        border = if (listingType == key) null else FilterChipDefaults.filterChipBorder(enabled = true, selected = false, borderColor = Border),
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Ink, selectedLabelColor = Color.White, containerColor = Color.White, labelColor = Muted),
                    )
                }
                if (city.isNotBlank()) Text("Near $city", color = MaterialTheme.colorScheme.primary, fontSize = 11.sp, modifier = Modifier.align(Alignment.CenterVertically))
            }
            MessageStrip(message, onClearMessage)
        }
        when {
            loading && properties.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = MaterialTheme.colorScheme.primary, strokeWidth = 2.dp) }
            properties.isEmpty() -> EmptyState("No homes found", "Try a different search or widen your budget range.", Modifier.weight(1f))
            else -> LazyVerticalGrid(
                columns = GridCells.Adaptive(minSize = 290.dp),
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 5.dp, bottom = 26.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                items(properties, key = { "explore-${it.id}" }) { listing ->
                    PropertyCard(
                        listing = listing,
                        saved = savedIds.contains(listing.id),
                        onClick = { onOpenProperty(listing) },
                        onToggleSaved = { onToggleSaved(listing) },
                        modifier = Modifier.fillMaxWidth(),
                        imageHeight = 182,
                    )
                }
            }
        }
    }
    if (filtersOpen) {
        FiltersSheet(
            city = city,
            minPrice = minPrice,
            maxPrice = maxPrice,
            onDismiss = { filtersOpen = false },
            onApply = { updatedCity, min, max ->
                onCityChange(updatedCity)
                onPriceChange(min, max)
                filtersOpen = false
                onSearch()
            },
        )
    }
}

@Composable
private fun FiltersSheet(
    city: String,
    minPrice: String,
    maxPrice: String,
    onDismiss: () -> Unit,
    onApply: (String, String, String) -> Unit,
) {
    var area by remember(city) { mutableStateOf(city) }
    var lower by remember(minPrice) { mutableStateOf(minPrice) }
    var upper by remember(maxPrice) { mutableStateOf(maxPrice) }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = Color.White) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 22.dp).padding(bottom = 26.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("Refine your search", color = Ink, fontWeight = FontWeight.Bold, fontSize = 21.sp)
            Text("A few details can make the right home easier to find.", color = Muted, fontSize = 12.sp)
            OutlinedTextField(value = area, onValueChange = { area = it }, label = { Text("City or neighbourhood") }, singleLine = true, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp), colors = sheetFieldColors())
            Text("Price range (₹)", color = Ink, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(value = lower, onValueChange = { lower = it.filter(Char::isDigit) }, label = { Text("Minimum") }, singleLine = true, modifier = Modifier.weight(1f), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), shape = RoundedCornerShape(14.dp), colors = sheetFieldColors())
                OutlinedTextField(value = upper, onValueChange = { upper = it.filter(Char::isDigit) }, label = { Text("Maximum") }, singleLine = true, modifier = Modifier.weight(1f), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), shape = RoundedCornerShape(14.dp), colors = sheetFieldColors())
            }
            Button(onClick = { onApply(area, lower, upper) }, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(15.dp), colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Ink)) {
                Text("Show homes", fontWeight = FontWeight.Bold)
            }
            TextButton(onClick = { area = ""; lower = ""; upper = "" }) { Text("Clear filters", color = Muted, fontSize = 12.sp) }
        }
    }
}

@Composable
private fun sheetFieldColors() = OutlinedTextFieldDefaults.colors(unfocusedBorderColor = Border, focusedBorderColor = MaterialTheme.colorScheme.primary, unfocusedContainerColor = Color.White, focusedContainerColor = Color.White)
