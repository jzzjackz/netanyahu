"use client";

import Link from "next/link";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#313338] text-white">
      <div className="mx-auto max-w-4xl p-6">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-[#b5bac1] hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to home
        </Link>

        <h1 className="mb-8 text-4xl font-bold">Terms of Service</h1>
        
        <div className="space-y-6 text-[#b5bac1]">
          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">1. Acceptance of Terms</h2>
            <p>
              By accessing and using Commz and AllInOne Vidz (collectively, "the Services"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these Terms of Service, please do not use the Services.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">2. Description of Service</h2>
            <p>
              Commz provides a communication platform for users to create servers, channels, and engage in text, voice, and video conversations. AllInOne Vidz provides a video sharing platform where users can upload, view, and interact with video content.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">3. User Conduct</h2>
            <p className="mb-2">You agree not to:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Use the Services for any illegal purpose or in violation of any laws</li>
              <li>Harass, abuse, threaten, or intimidate other users</li>
              <li>Post or transmit any content that is offensive, harmful, or violates others' rights</li>
              <li>Impersonate any person or entity</li>
              <li>Spam, flood, or otherwise disrupt the Services</li>
              <li>Upload malicious code, viruses, or any harmful software</li>
              <li>Attempt to gain unauthorized access to the Services or other users' accounts</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">4. Content</h2>
            <p className="mb-2">
              You retain ownership of content you post on the Services. By posting content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, and display your content in connection with operating the Services.
            </p>
            <p>
              You are solely responsible for the content you post. We reserve the right to remove any content that violates these Terms or is otherwise objectionable.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">5. Account Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time for violations of these Terms, illegal activity, or any other reason we deem appropriate. You may also delete your account at any time.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">6. Privacy</h2>
            <p>
              Your use of the Services is also governed by our Privacy Policy. We collect and use your information as described in our Privacy Policy to provide and improve the Services.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">7. Intellectual Property</h2>
            <p>
              The Services and their original content, features, and functionality are owned by us and are protected by international copyright, trademark, and other intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">8. Disclaimer of Warranties</h2>
            <p>
              The Services are provided "as is" and "as available" without warranties of any kind, either express or implied. We do not warrant that the Services will be uninterrupted, secure, or error-free.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Services.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">10. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify users of any material changes by posting the new Terms on this page. Your continued use of the Services after such changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-semibold text-white">11. Contact</h2>
            <p>
              If you have any questions about these Terms, please contact us through the platform's support channels.
            </p>
          </section>

          <div className="mt-8 border-t border-[#404249] pt-6 text-sm text-gray-500">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
