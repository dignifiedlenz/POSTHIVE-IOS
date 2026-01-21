import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TermsOfServicePageDE() {
  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-4 flex justify-end">
        <Link href="/legal/terms">
          <Button variant="outline" size="sm">
            🇬🇧 English
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Allgemeine Geschäftsbedingungen (AGB)</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert">
          <p className="text-sm text-muted-foreground">Stand: Januar 2026</p>

          <h2>§ 1 Geltungsbereich</h2>
          <p>
            Diese Allgemeinen Geschäftsbedingungen (nachfolgend "AGB") gelten für alle Verträge über die Nutzung 
            der POSTHIVE-Plattform (nachfolgend "Plattform") zwischen Lorenz Schäfer (nachfolgend "Anbieter") 
            und dem Nutzer (nachfolgend "Kunde").
          </p>
          <p>
            Abweichende, entgegenstehende oder ergänzende Allgemeine Geschäftsbedingungen des Kunden werden nur dann 
            und insoweit Vertragsbestandteil, als der Anbieter ihrer Geltung ausdrücklich zugestimmt hat.
          </p>

          <h2>§ 2 Vertragsgegenstand</h2>
          <p>
            POSTHIVE ist eine cloudbasierte Plattform für die Verwaltung von Post-Production-Workflows, 
            Video-Deliverables, Versionskontrolle und Client-Feedback.
          </p>
          <p>
            Der Anbieter stellt dem Kunden die Plattform zur Nutzung über das Internet zur Verfügung. 
            Der genaue Leistungsumfang ergibt sich aus der Leistungsbeschreibung und dem gewählten Tarif.
          </p>

          <h3>2.1 Verfügbare Tarife</h3>
          <ul>
            <li><strong>Free Tier:</strong> Grundlegende Funktionen mit eingeschränktem Speicherplatz</li>
            <li><strong>Pro Tier:</strong> Erweiterte Funktionen für professionelle Nutzer</li>
            <li><strong>Team Tier:</strong> Voller Funktionsumfang für Teams</li>
          </ul>

          <h2>§ 3 Vertragsschluss</h2>
          <p>
            Der Vertrag kommt durch die Registrierung des Kunden auf der Plattform zustande. Mit der Registrierung 
            gibt der Kunde ein verbindliches Angebot zum Abschluss eines Nutzungsvertrages ab.
          </p>
          <p>
            Der Anbieter nimmt das Angebot durch Freischaltung des Nutzerkontos an. Der Kunde erhält eine 
            Bestätigungs-E-Mail.
          </p>

          <h2>§ 4 Nutzungsrechte</h2>
          <p>
            Der Anbieter räumt dem Kunden für die Dauer des Vertrages ein nicht ausschließliches, nicht 
            übertragbares Recht zur Nutzung der Plattform ein.
          </p>
          <p>
            Die Nutzungsrechte gelten nur für den vertragsgemäßen Gebrauch. Der Kunde ist insbesondere nicht 
            berechtigt:
          </p>
          <ul>
            <li>Die Plattform unterzulizenzieren oder Dritten zur Nutzung zu überlassen</li>
            <li>Die Plattform zu kopieren, zu modifizieren oder abgeleitete Werke zu erstellen</li>
            <li>Die Plattform zurückzuentwickeln (Reverse Engineering)</li>
            <li>Sicherheitsmechanismen zu umgehen</li>
          </ul>

          <h2>§ 5 Pflichten des Kunden</h2>
          
          <h3>5.1 Registrierung und Zugangsdaten</h3>
          <p>
            Der Kunde ist verpflichtet, bei der Registrierung wahrheitsgemäße Angaben zu machen und diese 
            aktuell zu halten.
          </p>
          <p>
            Der Kunde hat seine Zugangsdaten geheim zu halten und vor dem Zugriff durch Dritte zu schützen. 
            Bei Verdacht auf Missbrauch ist der Anbieter unverzüglich zu informieren.
          </p>

          <h3>5.2 Unzulässige Nutzung</h3>
          <p>Der Kunde verpflichtet sich, die Plattform nicht zu nutzen für:</p>
          <ul>
            <li>Rechtswidrige Zwecke oder zur Förderung rechtswidriger Aktivitäten</li>
            <li>Das Hochladen von Viren, Malware oder schädlichem Code</li>
            <li>Das Versenden von Spam oder unerwünschter Werbung</li>
            <li>Die Verletzung von Rechten Dritter (insbesondere Urheberrechte)</li>
            <li>Übermäßige Belastung der Systemressourcen</li>
          </ul>

          <h2>§ 6 Verfügbarkeit und Wartung</h2>
          <p>
            Der Anbieter bemüht sich um eine möglichst hohe Verfügbarkeit der Plattform. Eine Verfügbarkeit 
            von 100% ist jedoch technisch nicht zu realisieren.
          </p>
          <p>
            Der Anbieter behält sich vor, die Plattform ganz oder teilweise für Wartungsarbeiten vorübergehend 
            außer Betrieb zu nehmen. Geplante Wartungsarbeiten werden nach Möglichkeit rechtzeitig angekündigt.
          </p>

          <h2>§ 7 Datenschutz</h2>
          <p>
            Der Anbieter behandelt alle personenbezogenen Daten des Kunden vertraulich und gemäß der geltenden 
            Datenschutzbestimmungen, insbesondere der DSGVO.
          </p>
          <p>
            Details zur Datenverarbeitung entnehmen Sie bitte unserer{" "}
            <Link href="/legal/privacy-de" className="text-blue-600 hover:underline">
              Datenschutzerklärung
            </Link>.
          </p>

          <h2>§ 8 Vergütung und Zahlung</h2>
          
          <h3>8.1 Preise</h3>
          <p>
            Die jeweils aktuellen Preise sind auf der Website ersichtlich. Alle Preise verstehen sich 
            zzgl. der gesetzlichen Umsatzsteuer.
          </p>

          <h3>8.2 Zahlungsbedingungen</h3>
          <p>
            Die Bezahlung erfolgt über Stripe. Bei Abonnements erfolgt die Abrechnung monatlich oder jährlich 
            im Voraus, je nach gewähltem Abrechnungszeitraum.
          </p>
          <p>
            Bei Zahlungsverzug ist der Anbieter berechtigt, den Zugang zur Plattform zu sperren.
          </p>

          <h3>8.3 Preisanpassungen</h3>
          <p>
            Der Anbieter behält sich vor, die Preise mit einer Ankündigungsfrist von 4 Wochen anzupassen. 
            Der Kunde hat in diesem Fall ein außerordentliches Kündigungsrecht.
          </p>

          <h2>§ 9 Vertragslaufzeit und Kündigung</h2>
          
          <h3>9.1 Kostenlose Accounts</h3>
          <p>
            Kostenlose Accounts können jederzeit von beiden Seiten ohne Einhaltung einer Frist gekündigt werden.
          </p>

          <h3>9.2 Kostenpflichtige Abonnements</h3>
          <p>
            Kostenpflichtige Abonnements verlängern sich automatisch um den gewählten Zeitraum (monatlich/jährlich), 
            sofern sie nicht gekündigt werden.
          </p>
          <p>
            Die Kündigung muss bis spätestens 48 Stunden vor Ablauf der aktuellen Abrechnungsperiode erfolgen.
          </p>

          <h3>9.3 Außerordentliche Kündigung</h3>
          <p>
            Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund 
            liegt insbesondere vor bei:
          </p>
          <ul>
            <li>Verstoß gegen diese AGB</li>
            <li>Zahlungsverzug von mehr als 30 Tagen</li>
            <li>Missbrauch der Plattform</li>
          </ul>

          <h2>§ 10 Haftung</h2>
          
          <h3>10.1 Haftungsbeschränkung</h3>
          <p>
            Der Anbieter haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie bei Verletzung von Leben, 
            Körper oder Gesundheit.
          </p>
          <p>
            Bei leichter Fahrlässigkeit haftet der Anbieter nur bei Verletzung wesentlicher Vertragspflichten 
            (Kardinalpflichten). In diesem Fall ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden 
            begrenzt.
          </p>

          <h3>10.2 Datenverlust</h3>
          <p>
            Der Anbieter ist nicht haftbar für Datenverluste, die durch technische Defekte, Angriffe Dritter oder 
            höhere Gewalt entstehen. Der Kunde ist für die Sicherung seiner eigenen Daten verantwortlich.
          </p>

          <h3>10.3 Inhalte von Nutzern</h3>
          <p>
            Der Anbieter macht sich die von Nutzern hochgeladenen Inhalte nicht zu eigen und haftet nicht für 
            rechtswidrige Inhalte, sofern er keine Kenntnis von diesen hat.
          </p>

          <h2>§ 11 Geistiges Eigentum</h2>
          <p>
            Alle Rechte an der Plattform, einschließlich Software, Design, Texten und Grafiken, verbleiben beim 
            Anbieter oder dessen Lizenzgebern.
          </p>
          <p>
            Der Kunde behält alle Rechte an den von ihm hochgeladenen Inhalten. Der Kunde räumt dem Anbieter 
            lediglich die für die Erbringung der Dienstleistung notwendigen Nutzungsrechte ein.
          </p>

          <h2>§ 12 Änderungen der AGB</h2>
          <p>
            Der Anbieter behält sich vor, diese AGB mit einer Ankündigungsfrist von 4 Wochen zu ändern. 
            Widerspricht der Kunde den Änderungen nicht innerhalb dieser Frist, gelten die Änderungen als angenommen.
          </p>
          <p>
            Bei Widerspruch hat der Anbieter ein außerordentliches Kündigungsrecht.
          </p>

          <h2>§ 13 Schlussbestimmungen</h2>
          
          <h3>13.1 Anwendbares Recht</h3>
          <p>
            Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
          </p>

          <h3>13.2 Gerichtsstand</h3>
          <p>
            Ist der Kunde Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches 
            Sondervermögen, ist ausschließlicher Gerichtsstand für alle Streitigkeiten München.
          </p>

          <h3>13.3 Salvatorische Klausel</h3>
          <p>
            Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die Wirksamkeit der 
            übrigen Bestimmungen hiervon unberührt.
          </p>

          <h2>Kontakt</h2>
          <p>
            Bei Fragen zu diesen AGB wenden Sie sich bitte an:<br />
            E-Mail: lb_schaefer@icloud.com<br />
            Telefon: +49160 6271848
          </p>

          <div className="mt-8 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Hinweis:</strong> Diese AGB stellen eine Grundlage dar und sollten von einem Fachanwalt 
              geprüft und an Ihre spezifischen Geschäftsmodelle angepasst werden.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

