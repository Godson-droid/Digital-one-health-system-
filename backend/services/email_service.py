import smtplib
import secrets
import uuid
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from typing import Optional
import os

class EmailService:
    def __init__(self):
        # Email configuration - can be set via environment variables
        self.smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.environ.get('SMTP_PORT', '587'))
        self.smtp_username = os.environ.get('SMTP_USERNAME', '')
        self.smtp_password = os.environ.get('SMTP_PASSWORD', '')
        self.from_email = os.environ.get('FROM_EMAIL', 'noreply@digitalonehealth.com')
        
    def generate_verification_token(self) -> str:
        """Generate a secure verification token"""
        return secrets.token_urlsafe(32)
    
    def generate_verification_expiry(self) -> datetime:
        """Generate verification token expiry (24 hours from now)"""
        return datetime.utcnow() + timedelta(hours=24)
    
    async def send_verification_email(self, email: str, username: str, token: str) -> bool:
        """Send email verification email"""
        try:
            # Create verification URL
            # Use deployed backend URL for verification
            backend_url = os.environ.get('BACKEND_URL', 'https://digital-one-health-system-cjum.onrender.com')
            verification_url = f"{backend_url}/api/auth/verify-email/{token}"
            
            # Create email content
            subject = "Digital One Health - Email Verification Required"
            
            html_body = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Email Verification</title>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }}
                    .button {{ display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                    .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 12px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 Digital One Health</h1>
                        <p>Secure Health Data Platform</p>
                    </div>
                    <div class="content">
                        <h2>Welcome, {username}!</h2>
                        <p>Thank you for registering with Digital One Health. To complete your account setup and ensure the security of your health data, please verify your email address.</p>
                        
                        <p><strong>Why verify your email?</strong></p>
                        <ul>
                            <li>🔒 Secure your account with two-factor authentication</li>
                            <li>📧 Receive important security notifications</li>
                            <li>🔄 Enable account recovery options</li>
                            <li>✅ Access all platform features</li>
                        </ul>
                        
                        <div style="text-align: center;">
                            <a href="{verification_url}" class="button">Verify Email Address</a>
                        </div>
                        
                        <p><strong>Security Notice:</strong> This verification link will expire in 24 hours for your security.</p>
                        
                        <p>If you didn't create this account, please ignore this email.</p>
                        
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
                        
                        <p><strong>Manual Verification:</strong></p>
                        <p>If the button doesn't work, copy and paste this link into your browser:</p>
                        <p style="word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 5px; font-family: monospace;">{verification_url}</p>
                    </div>
                    <div class="footer">
                        <p>Digital One Health - Secure Health Data Management</p>
                        <p>This is an automated message. Please do not reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            text_body = f"""
            Digital One Health - Email Verification Required
            
            Welcome, {username}!
            
            Thank you for registering with Digital One Health. To complete your account setup, please verify your email address by clicking the link below:
            
            {verification_url}
            
            This verification link will expire in 24 hours for your security.
            
            If you didn't create this account, please ignore this email.
            
            ---
            Digital One Health - Secure Health Data Management
            """
            
            return await self._send_email(email, subject, text_body, html_body)
            
        except Exception as e:
            print(f"Error sending verification email: {e}")
            return False
    
    async def send_welcome_email(self, email: str, username: str) -> bool:
        """Send welcome email after successful verification"""
        try:
            subject = "Welcome to Digital One Health - Account Verified!"
            
            html_body = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Welcome to Digital One Health</title>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f0fdf4; padding: 30px; border-radius: 0 0 10px 10px; }}
                    .feature {{ background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #16a34a; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✅ Account Verified!</h1>
                        <p>Welcome to Digital One Health</p>
                    </div>
                    <div class="content">
                        <h2>Hello {username},</h2>
                        <p>Congratulations! Your email has been successfully verified and your Digital One Health account is now fully activated.</p>
                        
                        <h3>🚀 What you can do now:</h3>
                        
                        <div class="feature">
                            <strong>📊 Create Health Records</strong><br>
                            Securely store and manage health data for humans, animals, and plants
                        </div>
                        
                        <div class="feature">
                            <strong>🔐 Blockchain Security</strong><br>
                            All your data is protected with cryptographic blockchain integrity
                        </div>
                        
                        <div class="feature">
                            <strong>🔒 Multi-Factor Authentication</strong><br>
                            Enable MFA for additional account security
                        </div>
                        
                        <div class="feature">
                            <strong>🔍 Research Access</strong><br>
                            Share anonymized data with researchers to advance health science
                        </div>
                        
                        <p><strong>Security Reminder:</strong> Your account is protected with enterprise-grade security including AES-256 encryption, JWT tokens, and blockchain integrity verification.</p>
                        
                        <p>Thank you for choosing Digital One Health for your secure health data management needs.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            text_body = f"""
            Digital One Health - Account Verified!
            
            Hello {username},
            
            Congratulations! Your email has been successfully verified and your Digital One Health account is now fully activated.
            
            What you can do now:
            - Create and manage secure health records
            - Benefit from blockchain security and integrity
            - Enable multi-factor authentication
            - Participate in health research (optional)
            
            Thank you for choosing Digital One Health!
            
            ---
            Digital One Health - Secure Health Data Management
            """
            
            return await self._send_email(email, subject, text_body, html_body)
            
        except Exception as e:
            print(f"Error sending welcome email: {e}")
            return False
    
    async def _send_email(self, to_email: str, subject: str, text_body: str, html_body: str) -> bool:
        """Send email using SMTP"""
        try:
            # Skip actual email sending in development/demo mode
            if not self.smtp_username or not self.smtp_password:
                print(f"📧 EMAIL SIMULATION - Would send to {to_email}")
                print(f"Subject: {subject}")
                print(f"Text Body: {text_body[:200]}...")
                return True
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.from_email
            msg['To'] = to_email
            
            # Attach text and HTML parts
            text_part = MIMEText(text_body, 'plain')
            html_part = MIMEText(html_body, 'html')
            
            msg.attach(text_part)
            msg.attach(html_part)
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)
            
            print(f"✅ Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to send email to {to_email}: {e}")
            return False