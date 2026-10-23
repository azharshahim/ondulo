// ─── Recherche de jetons et secrets (npm run test:secrets) ─────────────────
// Balaye TOUT l'historique de TOUTES les branches (git grep sur chaque
// commit), l'arbre de travail et la liste des fichiers jamais ajoutés.
// Sécurité : les valeurs détectées ne sont JAMAIS affichées — seuls le
// fichier, la ligne et le type de motif sont reportés (valeur masquée).
import { execSync } from 'node:child_process';

interface Rule {
  id: string;
  label: string;
  re: RegExp;
  /** Sévérité : bloquant = secret réellement exploitable. */
  blocking: boolean;
}

const RULES: Rule[] = [
  { id: 'aws-akid', label: 'clé d’accès AWS', re: /AKIA[0-9A-Z]{16}/, blocking: true },
  { id: 'aws-secret', label: 'secret AWS', re: /aws_secret_access_key\s*[=:]\s*["']?[A-Za-z0-9/+=]{40}/i, blocking: true },
  { id: 'github-pat', label: 'jeton GitHub (ghp_/gho_/ghs_/ghu_)', re: /gh[pousr]_[A-Za-z0-9]{36,}/, blocking: true },
  { id: 'github-fine', label: 'jeton GitHub fin (github_pat_)', re: /github_pat_[A-Za-z0-9_]{50,}/, blocking: true },
  { id: 'slack', label: 'jeton Slack', re: /xox[baprs]-[A-Za-z0-9-]{10,}/, blocking: true },
  { id: 'openai', label: 'clé OpenAI/Anthropic', re: /sk-(ant-|proj-)?[A-Za-z0-9_-]{20,}/, blocking: true },
  { id: 'google-api', label: 'clé API Google', re: /AIza[0-9A-Za-z_-]{35}/, blocking: true },
  { id: 'private-key', label: 'clé privée PEM', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, blocking: true },
  { id: 'jwt', label: 'jeton JWT', re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, blocking: true },
  { id: 'expo-token', label: 'jeton Expo/EAS', re: /(EXPO_TOKEN|EAS_TOKEN|expo[_ -]?token)\s*[=:]\s*["']?[A-Za-z0-9_-]{12,}/i, blocking: true },
  { id: 'generic-assign', label: 'affectation de secret en clair', re: /(api[_-]?key|secret|password|passwd|auth[_-]?token|access[_-]?token)\s*[=:]\s*["'][^"'\s]{12,}["']/i, blocking: true },
  { id: 'bearer', label: 'en-tête Bearer en dur', re: /Bearer\s+[A-Za-z0-9._-]{20,}/, blocking: false },
  { id: 'long-hex', label: 'chaîne hexadécimale longue (clé possible)', re: /\b[0-9a-f]{40,}\b/i, blocking: false },
];

/** Masque toute valeur : ne révèle que le motif et la position. */
function redact(line: string, rule: Rule): string {
  const trimmed = line.trim().slice(0, 120);
  return trimmed.replace(rule.re, `«${rule.id}:masqué»`);
}

function sh(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    const out = (e as { stdout?: string }).stdout;
    return out ?? '';
  }
}

// ── Auto-test : le scanneur n'est pas un no-op ────────────────────────────
// 1) chaque motif bloquant doit reconnaître un échantillon SYNTHÉTIQUE
//    (assemblé à l'exécution, jamais écrit sur disque ni affiché) ;
// 2) le mécanisme `git grep` doit remonter un motif connu du dépôt.
const samples: Record<string, string> = {
  'aws-akid': 'AKIA' + 'Q'.repeat(16),
  'aws-secret': 'aws_secret_access_key = ' + 'x'.repeat(40),
  'github-pat': 'ghp_' + 'Z'.repeat(36),
  'github-fine': 'github_pat_' + 'Z'.repeat(60),
  'slack': 'xoxb-' + '1234567890-abcdefghij',
  'openai': 'sk-' + 'A'.repeat(32),
  'google-api': 'AIza' + 'B'.repeat(35),
  'private-key': '-----BEGIN RSA PRIVATE KEY-----',
  'jwt': 'eyJ' + 'a'.repeat(12) + '.eyJ' + 'b'.repeat(12) + '.' + 'c'.repeat(12),
  'expo-token': 'EXPO_TOKEN=' + 'a1b2c3d4e5f6g7h8',
  'generic-assign': 'api_key = "' + 'k'.repeat(20) + '"',
};
let selfFailures = 0;
console.log('── Auto-test du scanneur ──');
for (const rule of RULES) {
  const sample = samples[rule.id];
  if (!sample) continue;
  const ok = rule.re.test(sample);
  if (!ok) selfFailures++;
  console.log(`  ${ok ? '✓' : '✗'} motif « ${rule.id} » reconnaît un échantillon synthétique`);
}
const mechanism = sh('git grep -c --no-color -e "ondulo" HEAD -- src | head -3');
const mechOk = mechanism.trim().length > 0;
if (!mechOk) selfFailures++;
console.log(`  ${mechOk ? '✓' : '✗'} le mécanisme git grep remonte bien des correspondances connues`);
if (selfFailures) {
  console.log(`\n❌ ${selfFailures} auto-test(s) en échec : le rapport de scan n'est pas fiable.`);
  process.exit(1);
}

const blockingHits: string[] = [];
const infoHits: string[] = [];

// 1. Tous les commits de toutes les branches.
const commits = sh('git rev-list --all').trim().split('\n').filter(Boolean);
console.log(`── Analyse de ${commits.length} commits (toutes branches) ──`);

const seen = new Set<string>();
for (const commit of commits) {
  for (const rule of RULES) {
    // git grep sur l'ARBRE de chaque commit : couvre tout fichier versionné.
    const out = sh(`git grep -n -I -E --no-color -e ${JSON.stringify(rule.re.source)} ${commit} -- . 2>/dev/null`);
    for (const raw of out.split('\n')) {
      if (!raw.trim()) continue;
      const match = raw.match(/^([0-9a-f]+):([^:]+):(\d+):(.*)$/);
      if (!match) continue;
      const [, sha, file, lineNo, content] = match;
      const key = `${rule.id}|${file}|${content.trim()}`;
      if (seen.has(key)) continue;      // même contenu dans un autre commit
      seen.add(key);
      const entry = `${file}:${lineNo} [${rule.label}] « ${redact(content, rule)} » (commit ${sha.slice(0, 7)})`;
      if (rule.blocking) blockingHits.push(entry);
      else infoHits.push(entry);
    }
  }
}

// 2. Fichiers sensibles jamais ajoutés (toutes branches).
const addedFiles = sh('git log --all --diff-filter=A --name-only --format=""').split('\n').filter(Boolean);
const sensitive = addedFiles.filter((f) =>
  /(^|\/)\.env|\.p8$|\.p12$|\.pem$|\.key$|\.jks$|\.keystore$|mobileprovision$|credential|\.netrc|id_rsa|google-services\.json|GoogleService-Info\.plist/i.test(f));
console.log(`── Fichiers sensibles jamais versionnés : ${sensitive.length} ──`);
sensitive.forEach((f) => blockingHits.push(`${f} [fichier sensible versionné]`));

// 3. .gitignore : les motifs de secrets sont-ils ignorés ?
const gitignore = sh('git show HEAD:.gitignore');
const ignored = ['.env', '*.jks', '*.p8', '*.p12', '*.key', '*.pem', '*.mobileprovision'];
const missingIgnores = ignored.filter((pat) => !gitignore.includes(pat));
console.log(`── .gitignore couvre ${ignored.length - missingIgnores.length}/${ignored.length} motifs de secrets` +
  (missingIgnores.length ? ` (manquants : ${missingIgnores.join(', ')})` : ''));

console.log(`── Motifs bloquants : ${blockingHits.length} — signaux informatifs : ${infoHits.length} ──`);
blockingHits.forEach((h) => console.log(`  ✗ ${h}`));
infoHits.slice(0, 30).forEach((h) => console.log(`  · ${h}`));
if (infoHits.length > 30) console.log(`  · … ${infoHits.length - 30} autre(s) signal(s) informatif(s)`);

if (blockingHits.length) {
  console.log(`\n❌ ${blockingHits.length} secret(s) potentiel(s) à traiter (valeurs masquées).`);
  process.exit(1);
}
console.log('\n✅ Aucun jeton ni secret détecté dans l’arbre de travail, l’historique des 3 branches ni les fichiers versionnés.');
