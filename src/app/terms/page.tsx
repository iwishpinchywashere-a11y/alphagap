export const metadata = {
  title: "Terms & Conditions | AlphaGap",
  description: "AlphaGap Terms of Service, Privacy Policy, and Disclaimer",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-300">
      <div className="max-w-3xl mx-auto px-5 py-16">
        <div className="mb-10">
          <a href="/" className="text-green-400 hover:text-green-300 text-sm transition-colors">← Back to AlphaGap</a>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service &amp; Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-10">Last updated: April 2026 &nbsp;|&nbsp; Beanstock Finance Ltd.</p>

        <div className="space-y-10 text-sm leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Agreement to Terms</h2>
            <p>
              By accessing or using AlphaGap (the &quot;Platform&quot;), operated by <strong className="text-white">Beanstock Finance Ltd.</strong> (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), you agree to be bound by these Terms of Service and Privacy Policy (&quot;Terms&quot;). If you do not agree to these Terms, do not access or use the Platform. By creating an account or subscribing, you confirm that you are at least 18 years old and have the legal capacity to enter into this agreement.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. Not Financial Advice — Important Disclaimer</h2>
            <p className="mb-3">
              <strong className="text-white">AlphaGap is an educational and informational intelligence tool only. Nothing on this Platform constitutes financial advice, investment advice, trading advice, or any recommendation to buy, sell, or hold any cryptocurrency, digital asset, token, or other financial instrument.</strong>
            </p>
            <p className="mb-3">
              The aGap scoring system, signals, reports, benchmarks, leaderboards, and all other data, analysis, and content provided on the Platform are based on proprietary algorithmic processing of publicly available on-chain and off-chain data. A high aGap score does not guarantee, predict, or imply future price appreciation or investment returns.
            </p>
            <p className="mb-3">
              Cryptocurrency and digital asset markets are highly speculative and volatile. You may lose some or all of your investment. Past performance of any signal, score, or strategy is not indicative of future results.
            </p>
            <p>
              You are solely responsible for all investment and financial decisions you make. Always conduct your own independent research and consult a qualified, licensed financial advisor before making any investment decisions. Beanstock Finance Ltd. is not a registered investment advisor, broker-dealer, or financial institution in any jurisdiction.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. Platform Access &amp; Subscriptions</h2>
            <p className="mb-3">
              AlphaGap offers both free and paid subscription tiers. Paid subscriptions are billed monthly through our payment processor, Stripe. By subscribing, you authorise Beanstock Finance Ltd. to charge your payment method on a recurring monthly basis until you cancel.
            </p>
            <p className="mb-3">
              You may cancel your subscription at any time through your account settings. Cancellation takes effect at the end of the current billing period — no partial refunds are issued for unused time in the billing cycle. We reserve the right to modify subscription pricing with at least 14 days&apos; notice.
            </p>
            <p>
              We reserve the right to suspend or terminate your account at any time for violation of these Terms, suspected fraud, or any other reason at our sole discretion. In such cases, you will not be entitled to a refund of any fees paid.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. Intellectual Property</h2>
            <p className="mb-3">
              All content on the Platform — including but not limited to the aGap scoring methodology, signal algorithms, reports, software, design, and branding — is the exclusive property of Beanstock Finance Ltd. and is protected by applicable copyright, trademark, and intellectual property laws.
            </p>
            <p>
              You are granted a limited, non-exclusive, non-transferable licence to access and use the Platform for your own personal, non-commercial purposes. You may not copy, reproduce, redistribute, scrape, resell, or create derivative works from any content on the Platform without our prior written consent.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-400 ml-2">
              <li>Use the Platform for any unlawful purpose or in violation of any applicable laws or regulations</li>
              <li>Scrape, crawl, or systematically extract data from the Platform</li>
              <li>Reverse engineer, decompile, or attempt to derive source code from the Platform</li>
              <li>Share your account credentials with any third party</li>
              <li>Use the Platform to manipulate markets, spread misinformation, or engage in any form of market manipulation</li>
              <li>Attempt to gain unauthorised access to any part of the Platform or its infrastructure</li>
              <li>Transmit any viruses, malware, or other harmful code</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. Data Accuracy &amp; Limitation of Liability</h2>
            <p className="mb-3">
              While we strive to provide accurate and up-to-date data, we make no warranties — express or implied — regarding the accuracy, completeness, reliability, or timeliness of any information on the Platform. Data may be delayed, incomplete, or contain errors.
            </p>
            <p className="mb-3">
              To the maximum extent permitted by applicable law, Beanstock Finance Ltd., its directors, employees, and affiliates shall not be liable for any direct, indirect, incidental, special, consequential, or exemplary damages, including but not limited to loss of profits, loss of data, or financial losses arising from your use of or inability to use the Platform or any content thereon.
            </p>
            <p>
              In jurisdictions that do not allow the exclusion of certain warranties or limitation of liability, our liability is limited to the maximum extent permitted by law.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. Privacy Policy</h2>
            <p className="mb-3">
              This section describes how Beanstock Finance Ltd. collects, uses, and protects your personal information when you use AlphaGap.
            </p>

            <h3 className="font-semibold text-white mt-4 mb-2">Information We Collect</h3>
            <ul className="list-disc list-inside space-y-1.5 text-gray-400 ml-2">
              <li><strong className="text-gray-300">Account information:</strong> name, email address, and hashed password when you register</li>
              <li><strong className="text-gray-300">Payment information:</strong> processed securely by Stripe — we do not store card details on our servers</li>
              <li><strong className="text-gray-300">Usage data:</strong> pages visited, features used, session duration, and similar analytics to improve the Platform</li>
              <li><strong className="text-gray-300">Technical data:</strong> IP address, browser type, device information, and cookies</li>
            </ul>

            <h3 className="font-semibold text-white mt-4 mb-2">How We Use Your Information</h3>
            <ul className="list-disc list-inside space-y-1.5 text-gray-400 ml-2">
              <li>To provide, operate, and improve the Platform</li>
              <li>To process payments and manage your subscription</li>
              <li>To send transactional emails (account verification, subscription receipts, password resets)</li>
              <li>To contact you about material changes to the Platform or these Terms</li>
              <li>To comply with legal obligations</li>
            </ul>

            <h3 className="font-semibold text-white mt-4 mb-2">Data Sharing</h3>
            <p className="mb-3">
              We do not sell your personal information. We share data only with trusted third-party service providers necessary to operate the Platform — including Stripe (payments), Resend (email), and Vercel (hosting) — who are contractually bound to protect your data. We may also disclose information if required by law or to protect our legal rights.
            </p>

            <h3 className="font-semibold text-white mt-4 mb-2">Data Retention &amp; Deletion</h3>
            <p className="mb-3">
              We retain your personal data for as long as your account is active or as needed to provide services. You may request deletion of your account and associated data by contacting us at <a href="mailto:hello@getbeanstock.com" className="text-green-400 hover:text-green-300">hello@getbeanstock.com</a>. Some data may be retained for legal compliance purposes.
            </p>

            <h3 className="font-semibold text-white mt-4 mb-2">Cookies</h3>
            <p>
              We use essential cookies to operate the Platform (authentication sessions). We may also use analytics cookies to understand usage patterns. You may disable non-essential cookies in your browser settings, though this may affect functionality.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">8. Third-Party Links &amp; Content</h2>
            <p>
              The Platform may contain links to third-party websites, data sources, or content. We are not responsible for the accuracy, content, or practices of any third-party sites. Links do not constitute endorsement.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">9. Modifications to the Platform &amp; Terms</h2>
            <p>
              We reserve the right to modify, suspend, or discontinue any part of the Platform at any time without notice. We may update these Terms at any time. Continued use of the Platform after changes are posted constitutes acceptance of the revised Terms. We will notify users of material changes by email or prominent notice on the Platform.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">10. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of the jurisdiction in which Beanstock Finance Ltd. is incorporated, without regard to conflict of law principles. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts of that jurisdiction.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-3">11. Contact</h2>
            <p>
              If you have any questions about these Terms or our privacy practices, please contact us at:
            </p>
            <div className="mt-3 text-gray-400">
              <p className="text-white font-medium">Beanstock Finance Ltd.</p>
              <p>Operating as AlphaGap</p>
              <p>
                Email:{" "}
                <a href="mailto:hello@getbeanstock.com" className="text-green-400 hover:text-green-300 transition-colors">
                  hello@getbeanstock.com
                </a>
              </p>
            </div>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-gray-800 text-xs text-gray-600">
          &copy; {new Date().getFullYear()} Beanstock Finance Ltd. All rights reserved.
        </div>
      </div>
    </div>
  );
}
