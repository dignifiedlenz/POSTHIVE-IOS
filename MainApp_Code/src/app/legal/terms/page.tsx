import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-4 flex justify-end">
        <Link href="/legal/terms-de">
          <Button variant="outline" size="sm">
            🇩🇪 Deutsch
          </Button>
        </Link>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Terms of Service</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert">
          <p className="text-sm text-muted-foreground">Last updated: January 2026</p>

          <h2>1. Scope of Application</h2>
          <p>
            These Terms of Service (hereinafter "Terms") apply to all contracts for the use of the POSTHIVE 
            platform (hereinafter "Platform") between Lorenz Schäfer (hereinafter "Provider") and the user 
            (hereinafter "Customer").
          </p>
          <p>
            Deviating, conflicting or supplementary terms and conditions of the Customer shall only become 
            part of the contract if and to the extent that the Provider has expressly agreed to their validity.
          </p>

          <h2>2. Subject Matter of the Contract</h2>
          <p>
            POSTHIVE is a cloud-based platform for managing post-production workflows, video deliverables, 
            version control, and client feedback.
          </p>
          <p>
            The Provider makes the Platform available to the Customer for use via the Internet. The exact 
            scope of services is defined in the service description and the selected plan.
          </p>

          <h3>2.1 Available Plans</h3>
          <ul>
            <li><strong>Free Tier:</strong> Basic features with limited storage space</li>
            <li><strong>Pro Tier:</strong> Extended features for professional users</li>
            <li><strong>Team Tier:</strong> Full feature set for teams</li>
          </ul>

          <h2>3. Conclusion of Contract</h2>
          <p>
            The contract is concluded when the Customer registers on the Platform. With registration, the 
            Customer makes a binding offer to conclude a user agreement.
          </p>
          <p>
            The Provider accepts the offer by activating the user account. The Customer will receive a 
            confirmation email.
          </p>

          <h2>4. Usage Rights</h2>
          <p>
            The Provider grants the Customer a non-exclusive, non-transferable right to use the Platform 
            for the duration of the contract.
          </p>
          <p>
            The usage rights apply only to the contractual use. In particular, the Customer is not authorized to:
          </p>
          <ul>
            <li>Sublicense the Platform or make it available to third parties</li>
            <li>Copy, modify or create derivative works of the Platform</li>
            <li>Reverse engineer the Platform</li>
            <li>Circumvent security mechanisms</li>
          </ul>

          <h2>5. Customer Obligations</h2>
          
          <h3>5.1 Registration and Access Data</h3>
          <p>
            The Customer is obliged to provide truthful information during registration and keep it up to date.
          </p>
          <p>
            The Customer must keep their access data secret and protect it from access by third parties. 
            If there is any suspicion of misuse, the Provider must be informed immediately.
          </p>

          <h3>5.2 Prohibited Use</h3>
          <p>The Customer undertakes not to use the Platform for:</p>
          <ul>
            <li>Illegal purposes or to promote illegal activities</li>
            <li>Uploading viruses, malware or harmful code</li>
            <li>Sending spam or unwanted advertising</li>
            <li>Violating third party rights (especially copyrights)</li>
            <li>Excessive use of system resources</li>
          </ul>

          <h2>6. Availability and Maintenance</h2>
          <p>
            The Provider strives for the highest possible availability of the Platform. However, 100% 
            availability is technically not feasible.
          </p>
          <p>
            The Provider reserves the right to temporarily take the Platform out of operation in whole or 
            in part for maintenance work. Planned maintenance work will be announced in advance if possible.
          </p>

          <h2>7. Data Protection</h2>
          <p>
            The Provider treats all personal data of the Customer confidentially and in accordance with 
            applicable data protection regulations, in particular the GDPR.
          </p>
          <p>
            For details on data processing, please refer to our{" "}
            <Link href="/legal/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </Link>.
          </p>

          <h2>8. Fees and Payment</h2>
          
          <h3>8.1 Prices</h3>
          <p>
            The current prices are shown on the website. All prices are exclusive of statutory VAT.
          </p>

          <h3>8.2 Payment Terms</h3>
          <p>
            Payment is made via Stripe. For subscriptions, billing is done monthly or annually in advance, 
            depending on the selected billing period.
          </p>
          <p>
            In case of payment default, the Provider is entitled to block access to the Platform.
          </p>

          <h3>8.3 Price Adjustments</h3>
          <p>
            The Provider reserves the right to adjust prices with 4 weeks' notice. In this case, the 
            Customer has an extraordinary right of termination.
          </p>

          <h2>9. Contract Term and Termination</h2>
          
          <h3>9.1 Free Accounts</h3>
          <p>
            Free accounts can be terminated at any time by either party without notice.
          </p>

          <h3>9.2 Paid Subscriptions</h3>
          <p>
            Paid subscriptions automatically renew for the selected period (monthly/annually) unless terminated.
          </p>
          <p>
            Cancellation must be made at least 48 hours before the end of the current billing period.
          </p>

          <h3>9.3 Extraordinary Termination</h3>
          <p>
            The right to extraordinary termination for good cause remains unaffected. Good cause exists 
            in particular in case of:
          </p>
          <ul>
            <li>Violation of these Terms</li>
            <li>Payment default of more than 30 days</li>
            <li>Misuse of the Platform</li>
          </ul>

          <h2>10. Liability</h2>
          
          <h3>10.1 Limitation of Liability</h3>
          <p>
            The Provider is unlimitedly liable for intent and gross negligence as well as for injury to 
            life, body or health.
          </p>
          <p>
            In case of slight negligence, the Provider is only liable for breach of essential contractual 
            obligations (cardinal obligations). In this case, liability is limited to the foreseeable, 
            typically occurring damage.
          </p>

          <h3>10.2 Data Loss</h3>
          <p>
            The Provider is not liable for data loss caused by technical defects, attacks by third parties 
            or force majeure. The Customer is responsible for backing up their own data.
          </p>

          <h3>10.3 User Content</h3>
          <p>
            The Provider does not adopt content uploaded by users as its own and is not liable for illegal 
            content unless it has knowledge of it.
          </p>

          <h2>11. Intellectual Property</h2>
          <p>
            All rights to the Platform, including software, design, texts and graphics, remain with the 
            Provider or its licensors.
          </p>
          <p>
            The Customer retains all rights to the content they upload. The Customer only grants the 
            Provider the usage rights necessary to provide the service.
          </p>

          <h2>12. Changes to the Terms</h2>
          <p>
            The Provider reserves the right to change these Terms with 4 weeks' notice. If the Customer 
            does not object to the changes within this period, the changes are deemed accepted.
          </p>
          <p>
            In case of objection, the Provider has an extraordinary right of termination.
          </p>

          <h2>13. Final Provisions</h2>
          
          <h3>13.1 Applicable Law</h3>
          <p>
            The law of the Federal Republic of Germany applies, excluding the UN Convention on Contracts 
            for the International Sale of Goods.
          </p>

          <h3>13.2 Place of Jurisdiction</h3>
          <p>
            If the Customer is a merchant, a legal entity under public law or a special fund under public 
            law, the exclusive place of jurisdiction for all disputes is Munich, Germany.
          </p>

          <h3>13.3 Severability Clause</h3>
          <p>
            Should individual provisions of these Terms be or become invalid, the validity of the remaining 
            provisions shall remain unaffected.
          </p>

          <h2>Contact</h2>
          <p>
            If you have any questions about these Terms, please contact:<br />
            Email: lb_schaefer@icloud.com<br />
            Phone: +49160 6271848
          </p>

          <div className="mt-8 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> These Terms provide a foundation and should be reviewed by a specialist 
              lawyer and adapted to your specific business model.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
