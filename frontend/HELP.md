# MountyHapp — Aide

Bienvenue ! Ce guide résume les étapes pour prendre en main le site.

Il est disponible:
- en version nagigateur sur PC
- en version navigateur mobile (mieux!)
- en version "application mobile" (vraiment mieux!)

En effet, sur smartphone ce compagnon pour MH peut être installée localement sur le téléphone presque comme une application classique.

Chrome le proposera directement via un pop-up:
![Installation manuelle](/images/pwa-install.png)

Bien que ce ne soit pas obligatiore, c'est assez pratique 🙂

Si sur votre mobile vous n'avez pas Chrome, mais que Firefox, ou Safari. Contactez moi

## Connexion et inscription

Créez un compte ou connectez-vous avec votre adresse e-mail et votre mot de passe. Après connexion, le menu latéral donne accès aux différentes sections.

ℹ️ *L'email à ce stade n'est pas vérifié. Vous pouvez en utiliser un "faux" si vous ne souhaitez pas utiliser d'informations personnelles.*

## Profil (Mon Tröll)

Dans **Mon Tröll**, renseignez au minimum votre **identifiant Tröll** (Troll ID).  
Vous pouvez aussi saisir :

- un **jeton SCIZ** pour activer la page du groupe SCIZ ;
- vos informations **BT** (système, identifiant, mot de passe) pour le groupe BT.

ℹ️ Pour SCIZ, il s'agit du "JWT" pour MountyZilla qui se récupère sur sciz.fr.  
ℹ️ Pour BT, ce sont les mêmes identifiants que pour accéder à l'IT sur la page des Bricol'Trolls.  

Si vous souhaitez davantage de détails, contactez moi :)

Enregistrez le profil pour que ces réglages soient pris en compte.

## Page SCIZ (`/group/sciz`)

La page **SCIZ Group** est disponible lorsque votre profil contient un jeton SCIZ. Elle regroupe les fonctionnalités liées à ce groupe. 

## Page BT (`/group/bt`)

La page **BT Group** utilise les informations BT définies dans le profil. 

C'est actuellement la section qui propose le plus de détails, les Bricol'Trölls mettant davantage d'informations à disposition.

## Page Monstres (`/monsters`)

La section **Monstres** permet de consulter ou gérer les monstres.

### 1️⃣ Ajouter un monstre par son ID

![Ajout](/images/pwa-add-monster.png)

### 2️⃣ Vérifier si il est présent dans MZ

A la suite de l'étape 1, le monstre devrait s'afficher dans l'interface, avec quelques champs vides et/ou grisés.
Effectuons une requète à MZ pour les remplir en cliquant sur le bouton "MZ Data"

![Vérification](/images/pwa-monster-added.png)

### 3️⃣ Consulter les infos

Ici le monstre a été trouvé dans MZ.
Ses caractéristiques sont affichées précisément, ainsi que ses PV actuels lors de la dernière CdM **partagée avec MZ**

![Consultation](/images/pwa-monster-in-mz.png)

ℹ️ *Le cartouche avec son ID change de couleur en fonction de son % de blessures.*

