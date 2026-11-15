package `in`.secureasset.android.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Ink = Color(0xFF142B3D)
val Blue = Color(0xFF2E7895)
val Accent = Color(0xFF7CBF83)
val Surface = Color(0xFFF5F7F4)
val Muted = Color(0xFF75858A)
val Border = Color(0xFFE2E9E5)
val PaleGreen = Color(0xFFEAF4EA)
val PaleBlue = Color(0xFFEAF2F5)

private val SecureAssetColors = lightColorScheme(
    primary = Blue,
    onPrimary = Color.White,
    secondary = Accent,
    onSecondary = Ink,
    background = Surface,
    onBackground = Ink,
    surface = Color.White,
    onSurface = Ink,
    surfaceVariant = PaleBlue,
    onSurfaceVariant = Muted,
    outline = Border,
    error = Color(0xFFB5443C),
)

@Composable
fun SecureAssetTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = SecureAssetColors, content = content)
}
