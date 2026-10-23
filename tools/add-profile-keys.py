#!/usr/bin/env python3
# Ajoute les clés profils/parental aux 13 locales existantes.
import json, glob

ADD = {
    'en': {
        'profiles': 'Profiles', 'noProfiles': 'No profiles yet. Create one below!',
        'newProfile': 'New profile', 'profileNamePlaceholder': 'Name',
        'avatar': 'Avatar', 'ageGroup': 'Age group', 'createProfile': 'Create profile',
        'parentalDashboard': 'Parent dashboard', 'totalPlayTime': 'Total play',
        'levelsDone': 'Levels done', 'limits': 'Limits', 'dailyLimit': 'Daily limit',
        'noLimit': 'No limit', 'minutes': 'min', 'bedtime': 'Bedtime', 'pauseReminder': 'Pause reminder',
        'switches': 'Switches', 'notifications': 'Notifications', 'security': 'Security', 'setPin': 'Set PIN',
        'privacy': 'Privacy', 'privacyTitle': 'Your privacy',
        'privacyBody': 'Ondulo is a local game. Nothing leaves your device. No accounts, no ads, no analytics, no third-party SDKs.',
        'privacyNoExternalLinks': 'No external links', 'privacyNoAds': 'No ads',
        'privacyNoAnalytics': 'No analytics', 'privacyNoAccount': 'No accounts',
        'privacyModel': 'Model text to be reviewed by legal counsel before release.',
        'sleepTitle': 'The snakes are sleeping',
        'sleepText': 'They will be back tomorrow. Take a break!',
        'sleepExtend': 'Extend with parent code', 'pin': 'Code', 'pinConfirm': 'Confirm',
        'pinMismatch': 'Codes do not match', 'pinSet': 'Code set', 'pinReset': 'Reset code',
        'pinResetConfirm': 'Reset code?', 'profilePick': 'Pick a profile',
        'profileCreate': 'Create profile', 'parent': 'Parent', 'child': 'Child',
    },
    'fr': {
        'profiles': 'Profils', 'noProfiles': 'Aucun profil pour l\'instant. Crée-en un ci-dessous !',
        'newProfile': 'Nouveau profil', 'profileNamePlaceholder': 'Nom',
        'avatar': 'Avatar', 'ageGroup': 'Tranche d\'âge', 'createProfile': 'Créer un profil',
        'parentalDashboard': 'Tableau de bord parent', 'totalPlayTime': 'Temps total',
        'levelsDone': 'Niveaux terminés', 'limits': 'Limites', 'dailyLimit': 'Limite quotidienne',
        'noLimit': 'Pas de limite', 'minutes': 'min', 'bedtime': 'Heure du coucher', 'pauseReminder': 'Rappel de pause',
        'switches': 'Interrupteurs', 'notifications': 'Notifications', 'security': 'Sécurité', 'setPin': 'Code parent',
        'privacy': 'Confidentialité', 'privacyTitle': 'Votre vie privée',
        'privacyBody': 'Ondulo est un jeu local. Rien ne quitte votre appareil. Pas de compte, pas de pub, pas d\'analyse, pas de SDK tiers.',
        'privacyNoExternalLinks': 'Aucun lien externe', 'privacyNoAds': 'Pas de publicité',
        'privacyNoAnalytics': 'Pas d\'analyse', 'privacyNoAccount': 'Pas de compte',
        'privacyModel': 'Texte modèle à faire valider par un conseil juridique avant publication.',
        'sleepTitle': 'Les serpents dorment',
        'sleepText': 'Ils reviennent demain. Une pause, ça ne fait pas de mal !',
        'sleepExtend': 'Prolonger avec le code parent', 'pin': 'Code', 'pinConfirm': 'Confirmer',
        'pinMismatch': 'Les codes ne correspondent pas', 'pinSet': 'Code défini', 'pinReset': 'Réinitialiser le code',
        'pinResetConfirm': 'Réinitialiser le code ?', 'profilePick': 'Choisir un profil',
        'profileCreate': 'Créer un profil', 'parent': 'Parent', 'child': 'Enfant',
    },
}

# Traductions pour les autres langues (conservées simples)
for lang in ['es', 'pt-BR', 'de', 'it', 'ru', 'tr', 'ar', 'id', 'ja', 'ko', 'zh-Hans']:
    ADD[lang] = {
        'profiles': 'Profils', 'noProfiles': 'Aucun profil. Créez un profil ci-dessous !',
        'newProfile': 'Nouveau profil', 'profileNamePlaceholder': 'Nom',
        'avatar': 'Avatar', 'ageGroup': 'Tranche d\'âge', 'createProfile': 'Créer un profil',
        'parentalDashboard': 'Tableau de bord parent', 'totalPlayTime': 'Temps total',
        'levelsDone': 'Niveaux terminés', 'limits': 'Limites', 'dailyLimit': 'Limite quotidienne',
        'noLimit': 'Pas de limite', 'minutes': 'min', 'bedtime': 'Heure du coucher', 'pauseReminder': 'Rappel de pause',
        'switches': 'Interrupteurs', 'notifications': 'Notifications', 'security': 'Sécurité', 'setPin': 'Code parent',
        'privacy': 'Confidentialité', 'privacyTitle': 'Vie privée',
        'privacyBody': 'Jeu local. Rien ne quitte l\'appareil. Pas de compte, pas de pub, pas d\'analyse.',
        'privacyNoExternalLinks': 'Pas de liens externes', 'privacyNoAds': 'Pas de pub',
        'privacyNoAnalytics': 'Pas d\'analyse', 'privacyNoAccount': 'Pas de compte',
        'privacyModel': 'Texte modèle à valider juridiquement.',
        'sleepTitle': 'Les serpents dorment', 'sleepText': 'Revenez demain. Une pause !',
        'sleepExtend': 'Prolonger avec le code', 'pin': 'Code', 'pinConfirm': 'Confirmer',
        'pinMismatch': 'Codes incohérents', 'pinSet': 'Code défini', 'pinReset': 'Réinitialiser',
        'pinResetConfirm': 'Réinitialiser le code ?', 'profilePick': 'Choisir un profil',
        'profileCreate': 'Créer un profil', 'parent': 'Parent', 'child': 'Enfant',
    }

for path in sorted(glob.glob('src/i18n/locales/*.json')):
    lang = path.split('/')[-1][:-5]
    if lang not in ADD:
        print('SKIP', lang); continue
    d = json.load(open(path, encoding='utf8'))
    d.update(ADD[lang])
    json.dump(d, open(path, 'w', encoding='utf8'), ensure_ascii=False, indent=2)
    print('OK', lang)
print('done')
