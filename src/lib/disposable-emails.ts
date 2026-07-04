// Common disposable / temporary email domains. Extend as needed.
export const DISPOSABLE_EMAIL_DOMAINS = new Set<string>([
  "mailinator.com","10minutemail.com","10minutemail.net","guerrillamail.com","guerrillamail.info",
  "guerrillamail.biz","guerrillamail.de","guerrillamail.net","guerrillamail.org","sharklasers.com",
  "grr.la","spam4.me","pokemail.net","yopmail.com","yopmail.fr","yopmail.net","tempmail.com",
  "temp-mail.org","temp-mail.io","tempmailo.com","tempmail.dev","tempmail.plus","tmpmail.org",
  "tmpmail.net","tmpeml.com","tmpbox.net","tmp-mail.org","dispostable.com","mytemp.email",
  "throwawaymail.com","trashmail.com","trashmail.de","trashmail.net","trashmail.io","fakeinbox.com",
  "fakemailgenerator.com","getnada.com","nada.email","maildrop.cc","mohmal.com","mintemail.com",
  "moakt.com","emailondeck.com","mailnesia.com","mailcatch.com","mailtemp.info","mail-temp.com",
  "mailtemporaire.fr","mailtemporaire.com","emailtemporario.com.br","spambog.com","spambog.ru",
  "spambog.de","inboxbear.com","inboxkitten.com","harakirimail.com","jetable.org","dropmail.me",
  "dropjar.com","33mail.com","mailsac.com","anonaddy.me","burnermail.io","mailpoof.com","mail.tm",
  "1secmail.com","1secmail.net","1secmail.org","edu.sa.com","luxusmail.org","mail-temporaire.fr",
  "tempail.com","tempinbox.com","tempinbox.co.uk","tempmails.net","tempr.email","discard.email",
  "discardmail.com","discardmail.de","fakemail.net","fakermail.com","mvrht.net","mvrht.com",
  "spamgourmet.com","mailexpire.com","incognitomail.org","incognitomail.com","mailforspam.com",
  "mailhazard.com","mailinator.net","mailinator.org","mailinator2.com","binkmail.com","bobmail.info",
  "chammy.info","devnullmail.com","letthemeatspam.com","mailin8r.com","mailinater.com","reallymymail.com",
  "safetymail.info","sendspamhere.com","sogetthis.com","spamherelots.com","spamhereplease.com",
  "thisisnotmyrealemail.com","tradermail.info","veryrealemail.com","zippymail.info","emlpro.com",
  "emlhub.com","emltmp.com","emailfake.com","email-fake.com","fakemail.fr","tempmail.email",
  "cool.fr.nf","jetable.fr.nf","nospam.ze.tc","nomail.xl.cx","mega.zik.dj","speed.1s.fr",
  "courriel.fr.nf","moncourrier.fr.nf","monemail.fr.nf","monmail.fr.nf","hidebox.org","hidemail.de",
  "wegwerfmail.de","wegwerfmail.net","wegwerfmail.org","muellmail.com","byom.de","trbvm.com",
  "trbvn.com","tafmail.com","spamex.com","spamavert.com","spamfree24.org","spamgoes.in","onewaymail.com",
  "getairmail.com","tempemail.co","tempemail.net","tempemail.com","tempmailaddress.com","20minutemail.com",
  "20mail.it","30minutemail.com","33mail.com","5ymail.com","tempmail.us.com","edu.auction",
]);

export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain) return false;
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;
  // also block subdomains of listed disposable domains
  for (const d of DISPOSABLE_EMAIL_DOMAINS) {
    if (domain.endsWith("." + d)) return true;
  }
  return false;
}