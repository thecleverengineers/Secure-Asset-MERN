package `in`.secureasset.android.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import androidx.compose.ui.layout.ContentScale
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.TextButton
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import `in`.secureasset.android.model.UserProfile
import `in`.secureasset.android.ui.AuthStage
import `in`.secureasset.android.ui.components.SecureAssetMark
import `in`.secureasset.android.ui.theme.Accent
import `in`.secureasset.android.ui.theme.Border
import `in`.secureasset.android.ui.theme.Ink
import `in`.secureasset.android.ui.theme.Muted
import `in`.secureasset.android.ui.theme.PaleGreen
import `in`.secureasset.android.ui.theme.Surface

private const val SIGN_IN_PHOTO = "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1500&q=86"

@Composable
fun AuthScreen(
    stage: AuthStage,
    busy: Boolean,
    error: String,
    message: String,
    pendingPhone: String,
    onStageChange: (AuthStage) -> Unit,
    onSignIn: (String, String) -> Unit,
    onRegister: (String, String, String, String) -> Unit,
    onVerifyRegistration: (String) -> Unit,
    onVerifyTwoFactor: (String) -> Unit,
    onRequestPasswordReset: (String) -> Unit,
    onResetPassword: (String, String) -> Unit,
    onContinueAsGuest: () -> Unit,
) {
    BoxWithConstraints(Modifier.fillMaxSize().background(Surface).safeDrawingPadding()) {
        val wide = maxWidth >= 900.dp
        if (wide) {
            Row(Modifier.fillMaxSize().padding(26.dp), horizontalArrangement = Arrangement.spacedBy(26.dp)) {
                AuthHero(Modifier.weight(1.2f).fillMaxHeight(), landscape = true)
                Surface(
                    modifier = Modifier.weight(0.8f).fillMaxHeight(),
                    shape = RoundedCornerShape(30.dp),
                    color = Color.White,
                    shadowElevation = 4.dp,
                ) {
                    AuthForm(
                        stage, busy, error, message, pendingPhone, onStageChange,
                        onSignIn, onRegister, onVerifyRegistration, onVerifyTwoFactor, onRequestPasswordReset, onResetPassword, onContinueAsGuest,
                        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 34.dp, vertical = 30.dp),
                    )
                }
            }
        } else {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding()) {
                AuthHero(Modifier.fillMaxWidth().height(300.dp), landscape = false)
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
                    color = Color.White,
                    shadowElevation = 8.dp,
                ) {
                    AuthForm(
                        stage, busy, error, message, pendingPhone, onStageChange,
                        onSignIn, onRegister, onVerifyRegistration, onVerifyTwoFactor, onRequestPasswordReset, onResetPassword, onContinueAsGuest,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 26.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun AuthHero(modifier: Modifier, landscape: Boolean) {
    Box(modifier.clip(RoundedCornerShape(30.dp)).background(Ink)) {
        AsyncImage(
            model = SIGN_IN_PHOTO,
            contentDescription = "Modern home exterior",
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0x33152F45), Color(0xF0152F45)))))
        Column(
            modifier = Modifier
                .align(if (landscape) Alignment.BottomStart else Alignment.BottomStart)
                .padding(if (landscape) 34.dp else 24.dp),
            verticalArrangement = Arrangement.spacedBy(13.dp),
        ) {
            Surface(shape = RoundedCornerShape(18.dp), color = Color.White.copy(alpha = 0.95f)) {
                Icon(Icons.Default.Home, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(12.dp).size(24.dp))
            }
            Text("A home that\nfeels like yours.", color = Color.White, fontSize = if (landscape) 42.sp else 35.sp, lineHeight = if (landscape) 47.sp else 40.sp, fontWeight = FontWeight.Bold, letterSpacing = (-1).sp)
            Text("Find considered spaces, trusted owners, and a more secure way to make your next move.", color = Color.White.copy(alpha = 0.88f), fontSize = 14.sp, lineHeight = 21.sp, modifier = Modifier.width(if (landscape) 360.dp else 310.dp))
        }
        SecureAssetMark(Modifier.align(Alignment.TopStart).padding(if (landscape) 30.dp else 24.dp))
    }
}

@Composable
private fun AuthForm(
    stage: AuthStage,
    busy: Boolean,
    error: String,
    message: String,
    pendingPhone: String,
    onStageChange: (AuthStage) -> Unit,
    onSignIn: (String, String) -> Unit,
    onRegister: (String, String, String, String) -> Unit,
    onVerifyRegistration: (String) -> Unit,
    onVerifyTwoFactor: (String) -> Unit,
    onRequestPasswordReset: (String) -> Unit,
    onResetPassword: (String, String) -> Unit,
    onContinueAsGuest: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var identifier by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var acceptedTerms by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(stage) {
        if (stage != AuthStage.LOGIN && stage != AuthStage.REGISTER) password = ""
        if (stage != AuthStage.REGISTER_OTP && stage != AuthStage.TWO_FACTOR && stage != AuthStage.RESET_PASSWORD) code = ""
        if (stage != AuthStage.RESET_PASSWORD) confirmPassword = ""
    }
    val switchStage: (AuthStage) -> Unit = { next ->
        password = ""
        code = ""
        confirmPassword = ""
        onStageChange(next)
    }
    val title = when (stage) {
        AuthStage.LOGIN -> "Welcome back"
        AuthStage.REGISTER -> "Create your account"
        AuthStage.REGISTER_OTP -> "Verify your number"
        AuthStage.TWO_FACTOR -> "Confirm it’s you"
        AuthStage.FORGOT_PASSWORD -> "Reset your password"
        AuthStage.RESET_PASSWORD -> "Choose a new password"
    }
    val subtitle = when (stage) {
        AuthStage.LOGIN -> "Sign in to discover your next home."
        AuthStage.REGISTER -> "Start with a secure tenant account."
        AuthStage.REGISTER_OTP -> "Enter the one-time code sent to ${pendingPhone.ifBlank { "your number" }}."
        AuthStage.TWO_FACTOR -> "Use your authenticator code or a recovery code."
        AuthStage.FORGOT_PASSWORD -> "Enter the email address or phone number on your account."
        AuthStage.RESET_PASSWORD -> "Enter the reset code we sent and choose a new password."
    }

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (stage == AuthStage.LOGIN || stage == AuthStage.REGISTER) SecureAssetMark()
        Text(title, color = Ink, fontSize = 27.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp)
        Text(subtitle, color = Muted, fontSize = 13.sp, lineHeight = 19.sp)
        Spacer(Modifier.height(4.dp))
        when (stage) {
            AuthStage.LOGIN -> {
                AuthField(identifier, { identifier = it }, "Email or phone", keyboardType = KeyboardType.Email)
                AuthField(password, { password = it }, "Password", password = true)
                TextButton(onClick = { switchStage(AuthStage.FORGOT_PASSWORD) }, modifier = Modifier.align(Alignment.End)) {
                    Text("Forgot password?", color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
                TextButton(onClick = { switchStage(AuthStage.REGISTER) }, modifier = Modifier.align(Alignment.End)) {
                    Text("Create an account", color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
                AuthActionButton("Sign in securely", busy, enabled = identifier.isNotBlank() && password.isNotBlank()) { onSignIn(identifier, password) }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                    Text("New to SecureAsset?", color = Muted, fontSize = 12.sp)
                    TextButton(onClick = { switchStage(AuthStage.REGISTER) }) { Text("Join today", color = Ink, fontWeight = FontWeight.Bold, fontSize = 12.sp) }
                }
            }
            AuthStage.REGISTER -> {
                AuthField(name, { name = it }, "Full name")
                AuthField(email, { email = it }, "Email address", keyboardType = KeyboardType.Email)
                AuthField(phone, { phone = it }, "Phone number", keyboardType = KeyboardType.Phone)
                AuthField(password, { password = it }, "Create password", password = true)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = acceptedTerms, onCheckedChange = { acceptedTerms = it }, colors = CheckboxDefaults.colors(checkedColor = MaterialTheme.colorScheme.primary))
                    Text("I agree to the SecureAsset terms and privacy notice.", color = Muted, fontSize = 11.sp, lineHeight = 16.sp)
                }
                AuthActionButton("Continue", busy, enabled = name.isNotBlank() && email.isNotBlank() && phone.isNotBlank() && password.length >= 8 && acceptedTerms) { onRegister(name, email, phone, password) }
                TextButton(onClick = { switchStage(AuthStage.LOGIN) }, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Already have an account? Sign in", color = Muted, fontSize = 12.sp) }
            }
            AuthStage.REGISTER_OTP -> {
                AuthField(code, { code = it.take(8) }, "One-time code", keyboardType = KeyboardType.Number)
                AuthActionButton("Verify and continue", busy, enabled = code.length >= 4) { onVerifyRegistration(code) }
                TextButton(onClick = { switchStage(AuthStage.LOGIN) }, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Back to sign in", color = Muted, fontSize = 12.sp) }
            }
            AuthStage.TWO_FACTOR -> {
                AuthField(code, { code = it.take(24) }, "Authenticator or recovery code", keyboardType = KeyboardType.Text)
                AuthActionButton("Verify sign-in", busy, enabled = code.length >= 6) { onVerifyTwoFactor(code) }
                TextButton(onClick = { switchStage(AuthStage.LOGIN) }, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Use a different account", color = Muted, fontSize = 12.sp) }
            }
            AuthStage.FORGOT_PASSWORD -> {
                AuthField(identifier, { identifier = it }, "Email or phone", keyboardType = KeyboardType.Email)
                AuthActionButton("Send reset code", busy, enabled = identifier.isNotBlank()) { onRequestPasswordReset(identifier) }
                TextButton(onClick = { switchStage(AuthStage.LOGIN) }, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Back to sign in", color = Muted, fontSize = 12.sp) }
            }
            AuthStage.RESET_PASSWORD -> {
                AuthField(code, { code = it.take(12) }, "Reset code", keyboardType = KeyboardType.NumberPassword)
                AuthField(password, { password = it }, "New password", password = true)
                AuthField(confirmPassword, { confirmPassword = it }, "Confirm new password", password = true)
                if (confirmPassword.isNotBlank() && password != confirmPassword) Text("Passwords do not match.", color = MaterialTheme.colorScheme.error, fontSize = 11.sp)
                AuthActionButton("Reset password", busy, enabled = code.length >= 4 && password.length >= 8 && password == confirmPassword) { onResetPassword(code, password) }
                TextButton(onClick = { switchStage(AuthStage.LOGIN) }, modifier = Modifier.align(Alignment.CenterHorizontally)) { Text("Back to sign in", color = Muted, fontSize = 12.sp) }
            }
        }
        if (message.isNotBlank()) {
            Surface(shape = RoundedCornerShape(12.dp), color = PaleGreen) {
                Text(message, color = Ink, fontSize = 12.sp, lineHeight = 17.sp, modifier = Modifier.fillMaxWidth().padding(12.dp))
            }
        }
        if (error.isNotBlank()) {
            Surface(shape = RoundedCornerShape(12.dp), color = Color(0xFFFFF0EE)) {
                Text(error, color = Color(0xFF9F3932), fontSize = 12.sp, lineHeight = 17.sp, modifier = Modifier.fillMaxWidth().padding(12.dp))
            }
        }
        TextButton(onClick = onContinueAsGuest, modifier = Modifier.align(Alignment.CenterHorizontally)) {
            Text("Continue browsing", color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
        Text("Secure access · Encrypted session · Built for your next move", color = Muted, fontSize = 10.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
    }
}

@Composable
private fun AuthField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    password: Boolean = false,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label, fontSize = 12.sp) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        shape = RoundedCornerShape(15.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = Border,
            focusedLabelColor = MaterialTheme.colorScheme.primary,
            unfocusedLabelColor = Muted,
            focusedContainerColor = Color.White,
            unfocusedContainerColor = Color.White,
        ),
    )
}

@Composable
private fun AuthActionButton(text: String, busy: Boolean, enabled: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().height(54.dp),
        enabled = enabled && !busy,
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = Ink, disabledContainerColor = Accent.copy(alpha = 0.42f)),
    ) {
        if (busy) CircularProgressIndicator(Modifier.size(18.dp), color = Ink, strokeWidth = 2.dp)
        else Text(text, fontSize = 14.sp, fontWeight = FontWeight.Bold)
    }
}
