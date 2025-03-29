<?php
session_start();
require_once "sidcon.php";
header('Content-Type: text/html; charset=UTF-8');

ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

$token = isset($_GET['token']) ? trim($_GET['token']) : '';
$message = '';

if (empty($token)) {
    $message = "Invalid or missing token.";
} else {
    $cxn = mysqli_connect($host, $user, $pass, $database);
    if (!$cxn) {
        $message = "Database connection failed.";
    } else {
        // Check if the token is valid and not expired
        $stmt = $cxn->prepare("SELECT user_id, expires FROM password_resets WHERE token = ?");
        if (!$stmt) {
            $message = "Database error.";
        } else {
            $stmt->bind_param("s", $token);
            $stmt->execute();
            $result = $stmt->get_result();
            $reset = $result->fetch_assoc();
            $stmt->close();

            if (!$reset) {
                $message = "Invalid or expired token.";
            } elseif (strtotime($reset['expires']) < time()) {
                $message = "This token has expired.";
            } else {
                $user_id = $reset['user_id'];

                // Handle password reset form submission
                if ($_SERVER['REQUEST_METHOD'] === 'POST') {
                    $new_password = isset($_POST['new_password']) ? $_POST['new_password'] : '';
                    $confirm_password = isset($_POST['confirm_password']) ? $_POST['confirm_password'] : '';

                    if (empty($new_password) || empty($confirm_password)) {
                        $message = "Both password fields are required.";
                    } elseif ($new_password !== $confirm_password) {
                        $message = "Passwords do not match.";
                    } elseif (strlen($new_password) < 8) {
                        $message = "Password must be at least 8 characters long.";
                    } else {
                        // Update the user's password
                        $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);
                        $stmt = $cxn->prepare("UPDATE siduser SET password = ? WHERE user_id = ?");
                        if (!$stmt) {
                            $message = "Database error.";
                        } else {
                            $stmt->bind_param("si", $hashed_password, $user_id);
                            $stmt->execute();
                            $stmt->close();

                            // Delete the used token
                            $stmt = $cxn->prepare("DELETE FROM password_resets WHERE token = ?");
                            $stmt->bind_param("s", $token);
                            $stmt->execute();
                            $stmt->close();

                            $message = "Password reset successfully! You can now sign in with your new password.";
                        }
                    }
                }
            }
        }
        $cxn->close();
    }
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>sID JAm - Reset Password</title>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="src/styles.css">
</head>
<body>
    <div id="resetPasswordContainer">
        <h2>Reset Password</h2>
        <?php if ($message): ?>
            <p style="color: <?php echo strpos($message, 'successfully') !== false ? 'green' : 'red'; ?>;">
                <?php echo htmlspecialchars($message); ?>
            </p>
        <?php endif; ?>
        <?php if (empty($message) || (strpos($message, 'successfully') === false && strpos($message, 'expired') === false && strpos($message, 'Invalid') === false)): ?>
            <form method="POST">
                <div class="form-group">
                    <label for="newPassword">New Password:</label>
                    <input type="password" id="newPassword" name="new_password" required>
                </div>
                <div class="form-group">
                    <label for="confirmPassword">Confirm Password:</label>
                    <input type="password" id="confirmPassword" name="confirm_password" required>
                </div>
                <button type="submit">Reset Password</button>
            </form>
        <?php endif; ?>
        <p><a href="index.php">Back to Sign In</a></p>
    </div>
</body>
</html>