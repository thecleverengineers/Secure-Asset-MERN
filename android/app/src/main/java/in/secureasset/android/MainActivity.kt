package `in`.secureasset.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.viewmodel.compose.viewModel
import `in`.secureasset.android.ui.AppViewModel
import `in`.secureasset.android.ui.SecureAssetApp
import `in`.secureasset.android.ui.theme.SecureAssetTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            SecureAssetTheme {
                val viewModel: AppViewModel = viewModel()
                SecureAssetApp(viewModel)
            }
        }
    }
}
