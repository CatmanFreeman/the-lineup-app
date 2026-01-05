// src/utils/emailService.js
//
// EMAIL SERVICE
//
// Handles sending emails for employment verification requests to off-app restaurants.
// Supports multiple email providers (SendGrid, AWS SES, etc.)

/**
 * Email Service Configuration
 * Set these in environment variables or Firebase config
 */
const EMAIL_CONFIG = {
  provider: process.env.REACT_APP_EMAIL_PROVIDER || "sendgrid", // "sendgrid" | "aws-ses" | "mailgun"
  apiKey: process.env.REACT_APP_EMAIL_API_KEY || "",
  fromEmail: process.env.REACT_APP_EMAIL_FROM || "noreply@thelineup.app",
  fromName: process.env.REACT_APP_EMAIL_FROM_NAME || "The Lineup",
};

/**
 * Send employment verification email to restaurant
 * 
 * @param {Object} params
 * @param {string} params.toEmail - Restaurant contact email
 * @param {string} params.restaurantName - Restaurant name
 * @param {string} params.employeeName - Employee name
 * @param {string} params.position - Job position
 * @param {string} params.startDate - Employment start date
 * @param {string} params.endDate - Employment end date
 * @param {string} params.verificationLink - Link to verify employment
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendVerificationEmail({
  toEmail,
  restaurantName,
  employeeName,
  position,
  startDate,
  endDate,
  verificationLink,
}) {
  if (!toEmail || !verificationLink) {
    return {
      success: false,
      error: "Missing required email parameters",
    };
  }

  const dateRange = formatDateRange(startDate, endDate);
  const subject = `Employment Verification Request - ${employeeName}`;
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4da3ff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .details { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .detail-row { margin: 10px 0; }
        .label { font-weight: bold; color: #666; }
        .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>The Lineup</h1>
          <p>Employment Verification Request</p>
        </div>
        <div class="content">
          <p>Hello ${restaurantName},</p>
          
          <p><strong>${employeeName}</strong> has requested verification of their employment at your restaurant.</p>
          
          <div class="details">
            <div class="detail-row">
              <span class="label">Employee:</span> ${employeeName}
            </div>
            <div class="detail-row">
              <span class="label">Position:</span> ${position}
            </div>
            <div class="detail-row">
              <span class="label">Employment Period:</span> ${dateRange}
            </div>
          </div>
          
          <p>To verify this employment, please click the button below:</p>
          
          <a href="${verificationLink}" class="button">Verify Employment</a>
          
          <p style="font-size: 12px; color: #666;">
            Or copy and paste this link into your browser:<br>
            <a href="${verificationLink}" style="color: #4da3ff; word-break: break-all;">${verificationLink}</a>
          </p>
          
          <p style="margin-top: 30px;">
            <strong>Why verify?</strong><br>
            Verified employment helps employees build trusted resumes and helps restaurants attract quality talent. 
            This is a one-click process that takes less than 10 seconds.
          </p>
          
          <p>
            <strong>Not on The Lineup yet?</strong><br>
            <a href="https://thelineup.app/restaurants/signup" style="color: #4da3ff;">
              Join The Lineup</a> to access our full suite of restaurant management tools, 
            employee scheduling, and more.
          </p>
        </div>
        <div class="footer">
          <p>This email was sent by The Lineup on behalf of ${employeeName}.</p>
          <p>If you did not expect this email, you can safely ignore it.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textBody = `
The Lineup - Employment Verification Request

Hello ${restaurantName},

${employeeName} has requested verification of their employment at your restaurant.

Employee: ${employeeName}
Position: ${position}
Employment Period: ${dateRange}

To verify this employment, please visit:
${verificationLink}

Why verify?
Verified employment helps employees build trusted resumes and helps restaurants attract quality talent.

Not on The Lineup yet?
Join The Lineup at https://thelineup.app/restaurants/signup to access our full suite of restaurant management tools.

This email was sent by The Lineup on behalf of ${employeeName}.
If you did not expect this email, you can safely ignore it.
  `;

  try {
    // Call backend Cloud Function to send email
    const response = await fetch("https://us-central1-thelineupapp-88c99.cloudfunctions.net/sendEmail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: toEmail,
        subject,
        html: htmlBody,
        text: textBody,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Email service returned ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      messageId: result.messageId || "sent",
    };
  } catch (error) {
    console.error("Error sending verification email:", error);
    
    // Fallback: Store in Firestore for backend processing
    try {
      const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
      const { db } = await import("../hooks/services/firebase");
      
      const emailQueueRef = collection(db, "emailQueue");
      await addDoc(emailQueueRef, {
        type: "employment_verification",
        to: toEmail,
        subject,
        html: htmlBody,
        text: textBody,
        metadata: {
          restaurantName,
          employeeName,
          position,
          startDate,
          endDate,
          verificationLink,
        },
        status: "pending",
        createdAt: serverTimestamp(),
      });

      return {
        success: true,
        message: "Email queued for sending",
      };
    } catch (queueError) {
      console.error("Error queueing email:", queueError);
      return {
        success: false,
        error: "Failed to send or queue email",
      };
    }
  }
}

/**
 * Format date range for email display
 */
function formatDateRange(startDate, endDate) {
  const formatDate = (dateString) => {
    if (!dateString) return "Present";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

