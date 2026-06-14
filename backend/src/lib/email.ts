import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY

let resendClient: Resend | null = null
if (apiKey) {
  resendClient = new Resend(apiKey)
}

export async function sendPasswordResetEmail(email: string, code: string): Promise<void> {
  const subject = 'TimeLens — Reset Your Password'
  const htmlContent = `
    <div style="font-family: sans-serif; background-color: #FFF8F1; padding: 40px; color: #2B2540;">
      <div style="max-width: 500px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #F0E8DD; border-radius: 24px; padding: 40px; box-shadow: 0 6px 16px rgba(43, 37, 64, 0.05);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="font-size: 24px; font-weight: 800; margin: 0; color: #7C6BF5;">TimeLens</h1>
          <p style="font-size: 14px; color: #6F6880; margin: 4px 0 0 0;">Your time, in focus.</p>
        </div>
        
        <h2 style="font-size: 20px; font-weight: 700; color: #2B2540; text-align: center; margin-bottom: 16px;">Reset Your Password</h2>
        
        <p style="font-size: 15px; line-height: 1.6; color: #6F6880; text-align: center; margin-bottom: 32px;">
          You requested to reset your password. Use the verification code below to complete the reset process:
        </p>
        
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background-color: #FBF4FF; border: 2px dashed #7C6BF5; border-radius: 16px; padding: 16px 32px; font-size: 32px; font-weight: 800; letter-spacing: 4px; color: #7C6BF5;">
            ${code}
          </div>
          <p style="font-size: 12px; color: #A39BB1; margin-top: 12px;">This code is valid for 15 minutes.</p>
        </div>
        
        <p style="font-size: 13px; line-height: 1.6; color: #A39BB1; text-align: center; margin-bottom: 0;">
          If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    </div>
  `

  if (resendClient) {
    try {
      await resendClient.emails.send({
        from: 'TimeLens <onboarding@resend.dev>',
        to: email,
        subject,
        html: htmlContent,
      })
      console.log(`Password reset email successfully sent to ${email} via Resend.`)
    } catch (err) {
      console.error(`Error sending email to ${email} via Resend SDK:`, err)
      throw err
    }
  } else {
    console.log('--- DEVELOPMENT MAIL LOG ---')
    console.log(`To: ${email}`)
    console.log(`Subject: ${subject}`)
    console.log(`Verification Code: ${code}`)
    console.log('-----------------------------')
  }
}
