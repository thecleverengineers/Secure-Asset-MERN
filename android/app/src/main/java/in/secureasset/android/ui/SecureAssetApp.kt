package `in`.secureasset.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import `in`.secureasset.android.ui.screens.ActivityScreen
import `in`.secureasset.android.ui.screens.AuthScreen
import `in`.secureasset.android.ui.screens.ExploreScreen
import `in`.secureasset.android.ui.screens.HomeScreen
import `in`.secureasset.android.ui.screens.ProfileScreen
import `in`.secureasset.android.ui.screens.PropertyDetailScreen
import `in`.secureasset.android.ui.screens.SavedScreen
import `in`.secureasset.android.ui.screens.TenantKycScreen
import `in`.secureasset.android.ui.screens.GuestProfileScreen
import `in`.secureasset.android.ui.theme.Ink
import `in`.secureasset.android.ui.theme.Surface as AppSurface

@Composable
fun SecureAssetApp(viewModel: AppViewModel) {
    val state by viewModel.state
    if (state.bootstrapping) {
        Box(Modifier.fillMaxSize().background(AppSurface), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Color(0xFF2E7895), strokeWidth = 2.dp)
        }
        return
    }

    val user = state.user
    if (user == null && state.authOpen) {
        AuthScreen(
            stage = state.authStage,
            busy = state.authBusy,
            error = state.authError,
            message = state.message,
            pendingPhone = state.pendingPhone,
            onStageChange = viewModel::changeAuthStage,
            onSignIn = viewModel::signIn,
            onRegister = viewModel::register,
            onVerifyRegistration = viewModel::verifyRegistration,
            onVerifyTwoFactor = viewModel::submitTwoFactor,
            onRequestPasswordReset = viewModel::requestPasswordReset,
            onResetPassword = viewModel::submitPasswordReset,
            onContinueAsGuest = viewModel::closeAuth,
        )
        return
    }

    if (state.kycOpen) {
        TenantKycScreen(
            profile = state.kycProfile,
            loading = state.kycLoading,
            busy = state.kycBusy,
            message = state.message,
            onBack = viewModel::closeKyc,
            onUpload = viewModel::uploadKycFile,
            onSubmit = viewModel::submitKyc,
            onUpdateWhatsApp = viewModel::updateKycWhatsapp,
            onClearMessage = viewModel::clearMessage,
        )
        return
    }

    val listing = state.selectedProperty
    if (listing != null) {
        PropertyDetailScreen(
            listing = listing,
            user = user,
            saved = viewModel.isSaved(listing),
            loading = state.detailLoading,
            busy = state.authBusy,
            applyOpen = state.applyOpen,
            message = state.message,
            onBack = viewModel::closeProperty,
            onToggleSaved = { viewModel.toggleSaved(listing) },
            onApply = viewModel::beginApplication,
            onCloseApplication = viewModel::closeApplication,
            onSubmitApplication = { unitId, fullName, phone, email, occupation, employer, income, idType, idNumber, address, moveIn, stayMonths, note ->
                viewModel.submitApplication(unitId, fullName, phone, email, occupation, employer, income, idType, idNumber, address, moveIn, stayMonths, note)
            },
            onClearMessage = viewModel::clearMessage,
        )
        return
    }

    BoxWithConstraints(Modifier.fillMaxSize().background(AppSurface)) {
        val wide = maxWidth >= 840.dp
        if (wide) {
            Row(Modifier.fillMaxSize().safeDrawingPadding()) {
                NavigationRail(containerColor = Color.White, contentColor = Ink) {
                    Surface(color = Color.White) {
                        Column(Modifier.padding(vertical = 15.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("S", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, modifier = Modifier.background(Ink, androidx.compose.foundation.shape.RoundedCornerShape(12.dp)).padding(horizontal = 14.dp, vertical = 9.dp))
                        }
                    }
                    navItems.forEach { item ->
                        NavigationRailItem(
                            selected = state.tab == item.tab,
                            onClick = { viewModel.openTab(item.tab) },
                            icon = { androidx.compose.material3.Icon(item.icon, contentDescription = item.tab.label) },
                            label = { Text(item.tab.label, fontSize = 10.sp) },
                            alwaysShowLabel = false,
                        )
                    }
                }
                Box(Modifier.weight(1f).fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                    Box(Modifier.widthIn(max = 1360.dp).fillMaxSize()) { MainContent(viewModel, state, user) }
                }
            }
        } else {
            Scaffold(
                containerColor = AppSurface,
                bottomBar = {
                    NavigationBar(containerColor = Color.White, tonalElevation = 8.dp) {
                        navItems.forEach { item ->
                            NavigationBarItem(
                                selected = state.tab == item.tab,
                                onClick = { viewModel.openTab(item.tab) },
                                icon = { androidx.compose.material3.Icon(item.icon, contentDescription = item.tab.label) },
                                label = { Text(item.tab.label, fontSize = 10.sp) },
                                colors = NavigationBarItemDefaults.colors(selectedIconColor = Color(0xFF2E7895), selectedTextColor = Ink, indicatorColor = Color(0xFFE6F1EF), unselectedIconColor = Color(0xFF87959A), unselectedTextColor = Color(0xFF87959A)),
                            )
                        }
                    }
                },
            ) { padding ->
                MainContent(viewModel, state, user, Modifier.padding(padding))
            }
        }
    }
}

private data class NavItem(val tab: MainTab, val icon: ImageVector)

private val navItems = listOf(
    NavItem(MainTab.HOME, Icons.Default.Home),
    NavItem(MainTab.EXPLORE, Icons.Default.Search),
    NavItem(MainTab.SAVED, Icons.Default.FavoriteBorder),
    NavItem(MainTab.ACTIVITY, Icons.Default.Notifications),
    NavItem(MainTab.PROFILE, Icons.Default.Person),
)

@Composable
private fun MainContent(viewModel: AppViewModel, state: AppState, user: `in`.secureasset.android.model.UserProfile?, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize()) {
        when (state.tab) {
            MainTab.HOME -> HomeScreen(
                user = user,
                properties = state.homeProperties,
                savedIds = state.savedProperties.mapTo(mutableSetOf()) { it.id },
                loading = state.homeLoading,
                message = state.message,
                onSearch = { value -> viewModel.setQuery(value); viewModel.search() },
                onOpenExplore = { viewModel.openTab(MainTab.EXPLORE) },
                onOpenSaved = { viewModel.openTab(MainTab.SAVED) },
                onOpenActivity = { viewModel.openTab(MainTab.ACTIVITY) },
                onSelectListingType = viewModel::setListingType,
                onOpenProperty = viewModel::openProperty,
                onToggleSaved = viewModel::toggleSaved,
                onClearMessage = viewModel::clearMessage,
            )
            MainTab.EXPLORE -> ExploreScreen(
                properties = state.exploreProperties,
                savedIds = state.savedProperties.mapTo(mutableSetOf()) { it.id },
                loading = state.exploreLoading,
                query = state.query,
                city = state.city,
                listingType = state.listingType,
                minPrice = state.minPrice,
                maxPrice = state.maxPrice,
                message = state.message,
                onQueryChange = viewModel::setQuery,
                onCityChange = viewModel::setCity,
                onTypeChange = viewModel::setListingType,
                onPriceChange = viewModel::setPriceRange,
                onSearch = viewModel::search,
                onOpenProperty = viewModel::openProperty,
                onToggleSaved = viewModel::toggleSaved,
                onClearMessage = viewModel::clearMessage,
            )
            MainTab.SAVED -> SavedScreen(
                listings = state.savedProperties,
                loading = state.savedLoading,
                signedIn = user != null,
                onSignIn = { viewModel.openAuth() },
                onOpenProperty = viewModel::openProperty,
                onRemove = viewModel::toggleSaved,
                onExplore = { viewModel.openTab(MainTab.EXPLORE) },
                message = state.message,
                onClearMessage = viewModel::clearMessage,
            )
            MainTab.ACTIVITY -> ActivityScreen(
                applications = state.applications,
                notifications = state.notifications,
                loading = state.activityLoading,
                signedIn = user != null,
                onSignIn = { viewModel.openAuth() },
                onMarkRead = viewModel::markRead,
                message = state.message,
                onClearMessage = viewModel::clearMessage,
            )
            MainTab.PROFILE -> if (user == null) {
                GuestProfileScreen(
                    onSignIn = { viewModel.openAuth() },
                    onCreateAccount = { viewModel.openAuth(AuthStage.REGISTER) },
                )
            } else ProfileScreen(
                    user = user,
                    savedCount = state.savedProperties.size,
                    ownedProperties = state.ownedProperties,
                    ownedLoading = state.ownedLoading,
                    message = state.message,
                    onSignOut = viewModel::signOut,
                    onClearMessage = viewModel::clearMessage,
                    onOpenOwnedListing = viewModel::openProperty,
                    onOpenKyc = viewModel::openKyc,
                )
        }
    }
}
