export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface py-16 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl p-8 shadow-lg border border-border">
        <h1 className="text-3xl font-bold text-primary mb-6">Privacy Policy</h1>
        <div className="prose prose-sm text-text-muted space-y-4">
          <p>Last updated: June 2026</p>
          <h2 className="text-lg font-semibold text-primary">1. Information We Collect</h2>
          <p>We collect information you provide directly: name, email address, contact number, and engineering drawings uploaded to our platform.</p>
          <h2 className="text-lg font-semibold text-primary">2. How We Use Your Information</h2>
          <p>Your information is used to provide quotation services, communicate about your projects, send booking reminders, and improve our AI estimation accuracy.</p>
          <h2 className="text-lg font-semibold text-primary">3. Data Storage</h2>
          <p>Your data is securely stored using Supabase infrastructure with row-level security policies. Uploaded files are stored in encrypted storage buckets.</p>
          <h2 className="text-lg font-semibold text-primary">4. Data Sharing</h2>
          <p>We do not sell or share your personal information with third parties. Engineering drawings are processed by AI for quotation purposes only and are not used for training.</p>
          <h2 className="text-lg font-semibold text-primary">5. Your Rights</h2>
          <p>You have the right to access, correct, or delete your personal data at any time. Contact us to exercise these rights.</p>
          <h2 className="text-lg font-semibold text-primary">6. Cookies</h2>
          <p>We use essential cookies for authentication and session management. No tracking or advertising cookies are used.</p>
          <h2 className="text-lg font-semibold text-primary">7. Contact</h2>
          <p>For privacy-related inquiries, please contact us at privacy@towerspurebred.com.</p>
        </div>
      </div>
    </div>
  );
}
