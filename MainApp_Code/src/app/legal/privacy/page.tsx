import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-4 flex justify-end">
        <Link href="/legal/privacy-de">
          <Button variant="outline" size="sm">
            🇩🇪 Deutsch
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Privacy Policy</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert">
          <p className="text-sm text-muted-foreground">Last updated: January 2026</p>

          <h2>1. Privacy at a Glance</h2>
          
          <h3>General Information</h3>
          <p>
            The following information provides a simple overview of what happens to your personal data when you 
            visit this website. Personal data is any data by which you can be personally identified.
          </p>

          <h3>Data Collection on This Website</h3>
          <h4>Who is responsible for data collection on this website?</h4>
          <p>
            Data processing on this website is carried out by the website operator. The contact details can be 
            found in the imprint of this website.
          </p>

          <h4>How do we collect your data?</h4>
          <p>
            Your data is collected in part by you providing it to us. This can be, for example, data that you 
            enter in a contact form.
          </p>
          <p>
            Other data is collected automatically or with your consent when you visit the website by our IT systems. 
            This is mainly technical data (e.g., internet browser, operating system, or time of page access).
          </p>

          <h4>What do we use your data for?</h4>
          <p>
            Part of the data is collected to ensure error-free provision of the website. Other data may be used 
            to analyze your user behavior and to provide and improve our services.
          </p>

          <h4>What rights do you have regarding your data?</h4>
          <p>
            You have the right to receive information about the origin, recipient, and purpose of your stored 
            personal data free of charge at any time. You also have the right to request the correction or 
            deletion of this data. If you have given consent to data processing, you can revoke this consent 
            at any time. You also have the right to request restriction of the processing of your personal data 
            under certain circumstances. Furthermore, you have the right to lodge a complaint with the competent 
            supervisory authority.
          </p>

          <h2>2. Hosting</h2>
          <p>We host our website with the following provider:</p>
          
          <h3>Vercel</h3>
          <p>
            This website is hosted by Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA.
          </p>
          <p>
            For details, please refer to Vercel's privacy policy:{" "}
            <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              https://vercel.com/legal/privacy-policy
            </a>
          </p>

          <h3>Supabase</h3>
          <p>
            We use Supabase for our database and authentication services. Supabase is provided by Supabase Inc.
          </p>
          <p>
            For details, please refer to Supabase's privacy policy:{" "}
            <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              https://supabase.com/privacy
            </a>
          </p>

          <h2>3. General Information and Mandatory Information</h2>
          
          <h3>Data Protection</h3>
          <p>
            The operators of these pages take the protection of your personal data very seriously. We treat your 
            personal data confidentially and in accordance with statutory data protection regulations and this 
            privacy policy.
          </p>
          <p>
            When you use this website, various personal data is collected. Personal data is data by which you 
            can be personally identified. This privacy policy explains what data we collect and what we use it 
            for. It also explains how and for what purpose this is done.
          </p>

          <h3>Responsible Party</h3>
          <p>
            The responsible party for data processing on this website is:
          </p>
          <p>
            Lorenz Schäfer<br />
            Auerfeldstr. 20<br />
            81541 München<br />
            Deutschland<br />
            Phone: +49160 6271848<br />
            Email: lb_schaefer@icloud.com
          </p>
          <p>
            The responsible party is the natural or legal person who, alone or jointly with others, decides on 
            the purposes and means of processing personal data (e.g., names, email addresses, etc.).
          </p>

          <h3>Storage Duration</h3>
          <p>
            Unless a more specific storage period has been stated within this privacy policy, your personal data 
            will remain with us until the purpose for data processing no longer applies. If you make a legitimate 
            request for deletion or revoke consent to data processing, your data will be deleted unless we have 
            other legally permissible reasons for storing your personal data (e.g., tax or commercial retention 
            periods); in the latter case, deletion will take place after these reasons no longer apply.
          </p>

          <h3>Legal Basis for Data Processing</h3>
          <p>
            We process your personal data only if we have a legal basis to do so. The legal bases are primarily:
          </p>
          <ul>
            <li>Your consent (Art. 6 para. 1 lit. a GDPR)</li>
            <li>Contract fulfillment (Art. 6 para. 1 lit. b GDPR)</li>
            <li>Legal obligation (Art. 6 para. 1 lit. c GDPR)</li>
            <li>Legitimate interests (Art. 6 para. 1 lit. f GDPR)</li>
          </ul>

          <h3>Right to Withdraw Consent</h3>
          <p>
            Many data processing operations are only possible with your express consent. You can revoke consent 
            you have already given at any time. The legality of the data processing carried out until the 
            revocation remains unaffected by the revocation.
          </p>

          <h3>Right to Object to Data Collection</h3>
          <p>
            If data processing is based on Art. 6 para. 1 lit. e or f GDPR, you have the right to object to the 
            processing of your personal data at any time for reasons arising from your particular situation. 
            We will then no longer process your personal data unless we can demonstrate compelling legitimate 
            grounds for the processing that override your interests, rights and freedoms, or the processing serves 
            to assert, exercise or defend legal claims.
          </p>

          <h3>Right to Lodge a Complaint</h3>
          <p>
            You have the right to lodge a complaint with a supervisory authority if you believe that the 
            processing of your personal data violates the GDPR.
          </p>

          <h2>4. Data Collection on This Website</h2>
          
          <h3>Account Registration</h3>
          <p>
            When you register for an account, we collect:
          </p>
          <ul>
            <li>Name</li>
            <li>Email address</li>
            <li>Password (encrypted)</li>
          </ul>
          <p>
            This data is necessary to provide you with access to our platform and its features. The legal basis 
            is Art. 6 para. 1 lit. b GDPR (contract fulfillment).
          </p>

          <h3>Workspace Data</h3>
          <p>
            When you create and use workspaces, we process:
          </p>
          <ul>
            <li>Workspace names and settings</li>
            <li>Projects and deliverables</li>
            <li>Files and media you upload</li>
            <li>Comments and feedback</li>
            <li>Team member information</li>
          </ul>
          <p>
            This data is processed to provide the service. The legal basis is Art. 6 para. 1 lit. b GDPR 
            (contract fulfillment).
          </p>

          <h3>Payment Data</h3>
          <p>
            For paid subscriptions, we use Stripe for payment processing. We do not store your credit card 
            information ourselves. Stripe processes:
          </p>
          <ul>
            <li>Payment information (credit card, etc.)</li>
            <li>Billing address</li>
            <li>Transaction history</li>
          </ul>
          <p>
            For details, see Stripe's privacy policy:{" "}
            <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              https://stripe.com/privacy
            </a>
          </p>

          <h3>Server Log Files</h3>
          <p>
            The website provider automatically collects and stores information in server log files that your 
            browser automatically transmits to us. These are:
          </p>
          <ul>
            <li>Browser type and version</li>
            <li>Operating system</li>
            <li>Referrer URL</li>
            <li>Hostname of the accessing computer</li>
            <li>Time of the server request</li>
            <li>IP address</li>
          </ul>
          <p>
            This data is not merged with other data sources. The legal basis is Art. 6 para. 1 lit. f GDPR 
            (legitimate interests in ensuring the technical operation of the website).
          </p>

          <h3>Contact Form and Email Contact</h3>
          <p>
            If you contact us via email or contact form, we will store the data you provide (email address, 
            name, message) to process your inquiry. The legal basis is Art. 6 para. 1 lit. f GDPR (legitimate 
            interest in responding to inquiries).
          </p>

          <h2>5. File Storage</h2>
          
          <h3>Bunny CDN</h3>
          <p>
            We use Bunny CDN for storing and delivering media files. Files you upload are stored on Bunny CDN's 
            servers. For details, see Bunny CDN's privacy policy:{" "}
            <a href="https://bunny.net/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              https://bunny.net/privacy
            </a>
          </p>

          <h2>6. Third-Party Services</h2>
          
          <h3>Google OAuth</h3>
          <p>
            If you choose to sign in with Google, we use Google OAuth for authentication. Google will share your 
            basic profile information (name, email) with us. For details, see Google's privacy policy:{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              https://policies.google.com/privacy
            </a>
          </p>

          <h2>7. Your Rights</h2>
          <p>You have the following rights regarding your personal data:</p>
          <ul>
            <li>Right to access (Art. 15 GDPR)</li>
            <li>Right to rectification (Art. 16 GDPR)</li>
            <li>Right to erasure (Art. 17 GDPR)</li>
            <li>Right to restriction of processing (Art. 18 GDPR)</li>
            <li>Right to data portability (Art. 20 GDPR)</li>
            <li>Right to object (Art. 21 GDPR)</li>
            <li>Right to withdraw consent (Art. 7 para. 3 GDPR)</li>
          </ul>
          <p>
            To exercise these rights, please contact us at: lb_schaefer@icloud.com
          </p>

          <h2>8. Data Security</h2>
          <p>
            We use appropriate technical and organizational security measures to protect your data against 
            accidental or intentional manipulation, loss, destruction, or access by unauthorized persons. 
            Our security measures are continuously improved in line with technological developments.
          </p>

          <h2>9. Data Transfer to Third Countries</h2>
          <p>
            Some of our service providers are located outside the European Economic Area (EEA). In these cases, 
            we ensure that appropriate safeguards are in place (e.g., EU Standard Contractual Clauses or adequacy 
            decisions).
          </p>

          <h2>Contact</h2>
          <p>
            If you have any questions about this privacy policy or data protection, please contact:<br />
            Email: lb_schaefer@icloud.com<br />
            Phone: +49160 6271848
          </p>

          <div className="mt-8 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> This privacy policy provides a foundation and should be reviewed by a 
              specialist lawyer and adapted to your specific services and data processing practices.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
