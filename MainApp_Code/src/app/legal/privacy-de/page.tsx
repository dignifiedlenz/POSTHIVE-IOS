import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicyPageDE() {
  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-4 flex justify-end">
        <Link href="/legal/privacy">
          <Button variant="outline" size="sm">
            🇬🇧 English
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datenschutzerklärung</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert">
          <p className="text-sm text-muted-foreground">Stand: Januar 2026</p>

          <h2>1. Datenschutz auf einen Blick</h2>
          
          <h3>Allgemeine Hinweise</h3>
          <p>
            Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, 
            wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert 
            werden können.
          </p>

          <h3>Datenerfassung auf dieser Website</h3>
          <h4>Wer ist verantwortlich für die Datenerfassung auf dieser Website?</h4>
          <p>
            Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten können Sie dem 
            Impressum dieser Website entnehmen.
          </p>

          <h4>Wie erfassen wir Ihre Daten?</h4>
          <p>
            Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen. Hierbei kann es sich z.B. um Daten handeln, 
            die Sie in ein Kontaktformular eingeben.
          </p>
          <p>
            Andere Daten werden automatisch oder nach Ihrer Einwilligung beim Besuch der Website durch unsere IT-Systeme erfasst. 
            Das sind vor allem technische Daten (z.B. Internetbrowser, Betriebssystem oder Uhrzeit des Seitenaufrufs).
          </p>

          <h4>Wofür nutzen wir Ihre Daten?</h4>
          <p>
            Ein Teil der Daten wird erhoben, um eine fehlerfreie Bereitstellung der Website zu gewährleisten. Andere Daten können 
            zur Analyse Ihres Nutzerverhaltens und zur Bereitstellung und Verbesserung unserer Dienste verwendet werden.
          </p>

          <h4>Welche Rechte haben Sie bezüglich Ihrer Daten?</h4>
          <p>
            Sie haben jederzeit das Recht, unentgeltlich Auskunft über Herkunft, Empfänger und Zweck Ihrer gespeicherten 
            personenbezogenen Daten zu erhalten. Sie haben außerdem ein Recht, die Berichtigung oder Löschung dieser Daten zu 
            verlangen. Wenn Sie eine Einwilligung zur Datenverarbeitung erteilt haben, können Sie diese Einwilligung jederzeit 
            widerrufen. Außerdem haben Sie das Recht, unter bestimmten Umständen die Einschränkung der Verarbeitung Ihrer 
            personenbezogenen Daten zu verlangen. Des Weiteren steht Ihnen ein Beschwerderecht bei der zuständigen 
            Aufsichtsbehörde zu.
          </p>

          <h2>2. Hosting</h2>
          <p>Wir hosten die Inhalte unserer Website bei folgenden Anbietern:</p>
          
          <h3>Vercel</h3>
          <p>
            Diese Website wird gehostet von Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA.
          </p>
          <p>
            Details entnehmen Sie der Datenschutzerklärung von Vercel:{" "}
            <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              https://vercel.com/legal/privacy-policy
            </a>
          </p>

          <h3>Supabase</h3>
          <p>
            Wir nutzen Supabase für unsere Datenbank- und Authentifizierungsdienste. Supabase wird bereitgestellt von Supabase Inc.
          </p>
          <p>
            Details entnehmen Sie der Datenschutzerklärung von Supabase:{" "}
            <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              https://supabase.com/privacy
            </a>
          </p>

          <h2>3. Allgemeine Hinweise und Pflichtinformationen</h2>
          
          <h3>Datenschutz</h3>
          <p>
            Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre 
            personenbezogenen Daten vertraulich und entsprechend den gesetzlichen Datenschutzvorschriften sowie dieser 
            Datenschutzerklärung.
          </p>
          <p>
            Wenn Sie diese Website benutzen, werden verschiedene personenbezogene Daten erhoben. Personenbezogene Daten 
            sind Daten, mit denen Sie persönlich identifiziert werden können. Die vorliegende Datenschutzerklärung erläutert, 
            welche Daten wir erheben und wofür wir sie nutzen. Sie erläutert auch, wie und zu welchem Zweck das geschieht.
          </p>

          <h3>Hinweis zur verantwortlichen Stelle</h3>
          <p>
            Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:
          </p>
          <p>
            Lorenz Schäfer<br />
            Auerfeldstr. 20<br />
            81541 München<br />
            Deutschland<br />
            Telefon: +49160 6271848<br />
            E-Mail: lb_schaefer@icloud.com
          </p>
          <p>
            Verantwortliche Stelle ist die natürliche oder juristische Person, die allein oder gemeinsam mit anderen über 
            die Zwecke und Mittel der Verarbeitung von personenbezogenen Daten (z.B. Namen, E-Mail-Adressen o. Ä.) entscheidet.
          </p>

          <h3>Speicherdauer</h3>
          <p>
            Soweit innerhalb dieser Datenschutzerklärung keine speziellere Speicherdauer genannt wurde, verbleiben Ihre 
            personenbezogenen Daten bei uns, bis der Zweck für die Datenverarbeitung entfällt. Wenn Sie ein berechtigtes 
            Löschersuchen geltend machen oder eine Einwilligung zur Datenverarbeitung widerrufen, werden Ihre Daten gelöscht, 
            sofern wir keine anderen rechtlich zulässigen Gründe für die Speicherung Ihrer personenbezogenen Daten haben 
            (z.B. steuer- oder handelsrechtliche Aufbewahrungsfristen); im letztgenannten Fall erfolgt die Löschung nach 
            Fortfall dieser Gründe.
          </p>

          <h3>Rechtsgrundlagen der Datenverarbeitung</h3>
          <p>
            Wir verarbeiten Ihre personenbezogenen Daten nur, wenn wir eine Rechtsgrundlage dafür haben. Die Rechtsgrundlagen 
            sind insbesondere:
          </p>
          <ul>
            <li>Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)</li>
            <li>Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO)</li>
            <li>Rechtliche Verpflichtung (Art. 6 Abs. 1 lit. c DSGVO)</li>
            <li>Berechtigte Interessen (Art. 6 Abs. 1 lit. f DSGVO)</li>
          </ul>

          <h3>Widerruf Ihrer Einwilligung zur Datenverarbeitung</h3>
          <p>
            Viele Datenverarbeitungsvorgänge sind nur mit Ihrer ausdrücklichen Einwilligung möglich. Sie können eine bereits 
            erteilte Einwilligung jederzeit widerrufen. Die Rechtmäßigkeit der bis zum Widerruf erfolgten Datenverarbeitung 
            bleibt vom Widerruf unberührt.
          </p>

          <h3>Widerspruchsrecht gegen die Datenerhebung</h3>
          <p>
            Wenn die Datenverarbeitung auf Grundlage von Art. 6 Abs. 1 lit. e oder f DSGVO erfolgt, haben Sie jederzeit das 
            Recht, aus Gründen, die sich aus Ihrer besonderen Situation ergeben, gegen die Verarbeitung Ihrer personenbezogenen 
            Daten Widerspruch einzulegen. Wir verarbeiten Ihre personenbezogenen Daten dann nicht mehr, es sei denn, wir können 
            zwingende schutzwürdige Gründe für die Verarbeitung nachweisen, die Ihre Interessen, Rechte und Freiheiten überwiegen, 
            oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.
          </p>

          <h3>Beschwerderecht bei der zuständigen Aufsichtsbehörde</h3>
          <p>
            Sie haben das Recht, sich bei einer Aufsichtsbehörde zu beschweren, wenn Sie der Ansicht sind, dass die Verarbeitung 
            Ihrer personenbezogenen Daten gegen die DSGVO verstößt.
          </p>

          <h2>4. Datenerfassung auf dieser Website</h2>
          
          <h3>Account-Registrierung</h3>
          <p>
            Bei der Registrierung eines Accounts erheben wir:
          </p>
          <ul>
            <li>Name</li>
            <li>E-Mail-Adresse</li>
            <li>Passwort (verschlüsselt)</li>
          </ul>
          <p>
            Diese Daten sind notwendig, um Ihnen Zugang zu unserer Plattform und deren Funktionen zu gewähren. Die 
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
          </p>

          <h3>Workspace-Daten</h3>
          <p>
            Wenn Sie Workspaces erstellen und nutzen, verarbeiten wir:
          </p>
          <ul>
            <li>Workspace-Namen und Einstellungen</li>
            <li>Projekte und Deliverables</li>
            <li>Von Ihnen hochgeladene Dateien und Medien</li>
            <li>Kommentare und Feedback</li>
            <li>Informationen zu Teammitgliedern</li>
          </ul>
          <p>
            Diese Daten werden verarbeitet, um die Dienstleistung bereitzustellen. Die Rechtsgrundlage ist Art. 6 Abs. 1 
            lit. b DSGVO (Vertragserfüllung).
          </p>

          <h3>Zahlungsdaten</h3>
          <p>
            Für kostenpflichtige Abonnements nutzen wir Stripe zur Zahlungsabwicklung. Wir speichern Ihre Kreditkarteninformationen 
            nicht selbst. Stripe verarbeitet:
          </p>
          <ul>
            <li>Zahlungsinformationen (Kreditkarte etc.)</li>
            <li>Rechnungsadresse</li>
            <li>Transaktionsverlauf</li>
          </ul>
          <p>
            Details entnehmen Sie der Datenschutzerklärung von Stripe:{" "}
            <a href="https://stripe.com/de/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              https://stripe.com/de/privacy
            </a>
          </p>

          <h3>Server-Log-Dateien</h3>
          <p>
            Der Website-Provider erhebt und speichert automatisch Informationen in Server-Log-Dateien, die Ihr Browser 
            automatisch an uns übermittelt. Dies sind:
          </p>
          <ul>
            <li>Browsertyp und Browserversion</li>
            <li>Verwendetes Betriebssystem</li>
            <li>Referrer URL</li>
            <li>Hostname des zugreifenden Rechners</li>
            <li>Uhrzeit der Serveranfrage</li>
            <li>IP-Adresse</li>
          </ul>
          <p>
            Eine Zusammenführung dieser Daten mit anderen Datenquellen wird nicht vorgenommen. Die Rechtsgrundlage ist 
            Art. 6 Abs. 1 lit. f DSGVO (berechtigte Interessen an der Sicherstellung des technischen Betriebs der Website).
          </p>

          <h3>Kontaktformular und E-Mail-Kontakt</h3>
          <p>
            Wenn Sie uns per E-Mail oder Kontaktformular kontaktieren, werden die von Ihnen mitgeteilten Daten (E-Mail-Adresse, 
            Name, Nachricht) zur Bearbeitung Ihrer Anfrage gespeichert. Die Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO 
            (berechtigtes Interesse an der Beantwortung von Anfragen).
          </p>

          <h2>5. Dateispeicherung</h2>
          
          <h3>Bunny CDN</h3>
          <p>
            Wir nutzen Bunny CDN zur Speicherung und Auslieferung von Mediendateien. Von Ihnen hochgeladene Dateien werden 
            auf Servern von Bunny CDN gespeichert. Details entnehmen Sie der Datenschutzerklärung von Bunny CDN:{" "}
            <a href="https://bunny.net/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              https://bunny.net/privacy
            </a>
          </p>

          <h2>6. Drittanbieter-Dienste</h2>
          
          <h3>Google OAuth</h3>
          <p>
            Wenn Sie sich mit Google anmelden, nutzen wir Google OAuth zur Authentifizierung. Google teilt uns Ihre 
            grundlegenden Profilinformationen (Name, E-Mail) mit. Details entnehmen Sie der Datenschutzerklärung von Google:{" "}
            <a href="https://policies.google.com/privacy?hl=de" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              https://policies.google.com/privacy?hl=de
            </a>
          </p>

          <h2>7. Ihre Rechte</h2>
          <p>Sie haben folgende Rechte bezüglich Ihrer personenbezogenen Daten:</p>
          <ul>
            <li>Recht auf Auskunft (Art. 15 DSGVO)</li>
            <li>Recht auf Berichtigung (Art. 16 DSGVO)</li>
            <li>Recht auf Löschung (Art. 17 DSGVO)</li>
            <li>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
            <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
            <li>Widerspruchsrecht (Art. 21 DSGVO)</li>
            <li>Recht auf Widerruf einer Einwilligung (Art. 7 Abs. 3 DSGVO)</li>
          </ul>
          <p>
            Um diese Rechte auszuüben, kontaktieren Sie uns bitte unter: lb_schaefer@icloud.com
          </p>

          <h2>8. Datensicherheit</h2>
          <p>
            Wir verwenden geeignete technische und organisatorische Sicherheitsmaßnahmen, um Ihre Daten gegen zufällige 
            oder vorsätzliche Manipulationen, Verlust, Zerstörung oder den Zugriff unberechtigter Personen zu schützen. 
            Unsere Sicherheitsmaßnahmen werden entsprechend der technologischen Entwicklung fortlaufend verbessert.
          </p>

          <h2>9. Datenübermittlung in Drittländer</h2>
          <p>
            Einige unserer Dienstleister befinden sich außerhalb des Europäischen Wirtschaftsraums (EWR). In diesen Fällen 
            stellen wir sicher, dass angemessene Garantien vorhanden sind (z.B. EU-Standardvertragsklauseln oder 
            Angemessenheitsbeschlüsse).
          </p>

          <h2>Kontakt</h2>
          <p>
            Wenn Sie Fragen zu dieser Datenschutzerklärung oder zum Datenschutz haben, kontaktieren Sie uns bitte:<br />
            E-Mail: lb_schaefer@icloud.com<br />
            Telefon: +49160 6271848
          </p>

          <div className="mt-8 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Hinweis:</strong> Diese Datenschutzerklärung stellt eine Grundlage dar und sollte von einem 
              Fachanwalt geprüft und an Ihre spezifischen Dienste und Datenverarbeitungspraktiken angepasst werden.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

