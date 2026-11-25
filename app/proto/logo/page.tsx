import Link from "next/link";
import type { ReactNode } from "react";

const PALETTE = [
  "#A8241C", "#DA3731", "#E26E38", "#E9993E", "#EEBA46",
  "#99C555", "#4AA35B", "#4BA69E", "#3A83A3", "#22539F",
] as const;

const CULTURAL_ICONS = [
  { name: "Ilonggo", subtitle: "Warmth · rhythm · woven pride", icon: <IlonggoIcon /> },
  { name: "Tagalog", subtitle: "Home · language · rising light", icon: <TagalogIcon /> },
  { name: "Kalabaw", subtitle: "Strength · patience · the land", icon: <KalabawIcon /> },
  { name: "Sea", subtitle: "Current · journey · abundance", icon: <SeaIcon /> },
  { name: "Tarsier", subtitle: "Wonder · focus · the wild", icon: <TarsierIcon /> },
  { name: "Mango", subtitle: "Brightness · sweetness · welcome", icon: <MangoIcon /> },
  { name: "Narra tree", subtitle: "Roots · shelter · resilience", icon: <NarraIcon /> },
] as const;

const EXPERIENCE_ICONS = [
  { name: "Diving / sea creature", subtitle: "Depth · discovery · marine life", icon: <DivingIcon /> },
  { name: "Beach / island", subtitle: "Shore · sun · escape", icon: <BeachIcon /> },
  { name: "Nature / mountain / trekking", subtitle: "Trail · summit · adventure", icon: <TrekkingIcon /> },
  { name: "Karaoke", subtitle: "Voice · music · togetherness", icon: <KaraokeIcon /> },
  { name: "Shopping", subtitle: "Finds · gifts · local craft", icon: <ShoppingIcon /> },
  { name: "Weddings", subtitle: "Union · joy · celebration", icon: <WeddingIcon /> },
  { name: "Meetings / business", subtitle: "Ideas · exchange · progress", icon: <BusinessIcon /> },
  { name: "Education / English", subtitle: "Language · learning · growth", icon: <EducationIcon /> },
  { name: "Culture sights / church / weaves / dancers", subtitle: "Heritage · faith · movement", icon: <CultureIcon /> },
  { name: "Health / spa", subtitle: "Rest · balance · renewal", icon: <SpaIcon /> },
  { name: "Woman with hijab", subtitle: "Identity · grace · belonging", icon: <HijabIcon /> },
  { name: "Golf", subtitle: "Focus · fairway · leisure", icon: <GolfIcon /> },
] as const;

const DARK_EXPERIENCE_ICONS = [
  { name: "Diving / sea creature", subtitle: "Dark palette study · depth", icon: <DivingIcon dark /> },
  { name: "Beach / island", subtitle: "Dark palette study · shore", icon: <BeachIcon dark /> },
  { name: "Nature / mountain / trekking", subtitle: "Dark palette study · trail", icon: <TrekkingIcon dark /> },
  { name: "Karaoke", subtitle: "Dark palette study · voice", icon: <KaraokeIcon dark /> },
  { name: "Shopping", subtitle: "Dark palette study · local finds", icon: <ShoppingIcon dark /> },
  { name: "Weddings", subtitle: "Dark palette study · union", icon: <WeddingIcon dark /> },
  { name: "Meetings / business", subtitle: "Dark palette study · exchange", icon: <BusinessIcon dark /> },
  { name: "Education / English", subtitle: "Dark palette study · learning", icon: <EducationIcon dark /> },
  { name: "Culture sights / church / weaves / dancers", subtitle: "Dark palette study · heritage", icon: <CultureIcon dark /> },
  { name: "Health / spa", subtitle: "Dark palette study · renewal", icon: <SpaIcon dark /> },
  { name: "Woman with hijab", subtitle: "Dark palette study · identity", icon: <HijabIcon dark /> },
  { name: "Golf", subtitle: "Dark palette study · fairway", icon: <GolfIcon dark /> },
] as const;

const VIBRANT_EXPERIENCE_ICONS = [
  { name: "Diving / sea creature", subtitle: "Three-color study · depth", icon: <VibrantDivingIcon /> },
  { name: "Beach / island", subtitle: "Three-color study · shore", icon: <VibrantBeachIcon /> },
  { name: "Nature / mountain / trekking", subtitle: "Three-color study · trail", icon: <VibrantTrekkingIcon /> },
  { name: "Karaoke", subtitle: "Three-color study · voice", icon: <VibrantKaraokeIcon /> },
  { name: "Shopping", subtitle: "Three-color study · local finds", icon: <VibrantShoppingIcon /> },
  { name: "Weddings", subtitle: "Three-color study · union", icon: <VibrantWeddingIcon /> },
  { name: "Meetings / business", subtitle: "Three-color study · exchange", icon: <VibrantBusinessIcon /> },
  { name: "Education / English", subtitle: "Three-color study · learning", icon: <VibrantEducationIcon /> },
  { name: "Culture sights / church / weaves / dancers", subtitle: "Three-color study · heritage", icon: <VibrantCultureIcon /> },
  { name: "Health / spa", subtitle: "Three-color study · renewal", icon: <VibrantSpaIcon /> },
  { name: "Woman with hijab", subtitle: "Three-color study · identity", icon: <VibrantHijabIcon /> },
  { name: "Golf", subtitle: "Three-color study · fairway", icon: <VibrantGolfIcon /> },
] as const;

const PEG_EXPERIENCE_ICONS = [
  { name: "Diving / sea creature", subtitle: "Peg study · vessel and bubbles", icon: <PegDivingIcon /> },
  { name: "Beach / island", subtitle: "Peg study · sun and shore", icon: <PegBeachIcon /> },
  { name: "Nature / mountain / trekking", subtitle: "Peg study · repeated peaks", icon: <PegTrekkingIcon /> },
  { name: "Karaoke", subtitle: "Peg study · voice and rhythm", icon: <PegKaraokeIcon /> },
  { name: "Shopping", subtitle: "Peg study · market geometry", icon: <PegShoppingIcon /> },
  { name: "Weddings", subtitle: "Peg study · floral union", icon: <PegWeddingIcon /> },
  { name: "Meetings / business", subtitle: "Peg study · table and people", icon: <PegBusinessIcon /> },
  { name: "Education / English", subtitle: "Peg study · learning grid", icon: <PegEducationIcon /> },
  { name: "Culture sights / church / weaves / dancers", subtitle: "Peg study · woven leaf", icon: <PegCultureIcon /> },
  { name: "Health / spa", subtitle: "Peg study · botanical calm", icon: <PegSpaIcon /> },
  { name: "Woman with hijab", subtitle: "Peg study · portrait and drape", icon: <PegHijabIcon /> },
  { name: "Golf", subtitle: "Peg study · flag and green", icon: <PegGolfIcon /> },
] as const;

function DotTile({ label, background, children }: { label: string; background: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 240 240"
      role="img"
      aria-label={`${label} geometric icon`}
      className="block h-full w-full"
      style={{ backgroundColor: background }}
    >
      <title>{label}</title>
      <rect width="240" height="240" fill={background} />
      {children}
    </svg>
  );
}

function IlonggoIcon() {
  return (
    <DotTile label="Ilonggo" background="#DA3731">
      <path d="M0 0h120v240H0Z" fill="#A8241C" />
      <path d="m45 59 20 35H25Z" fill="#FFFFFF" />
      <path d="m195 59 20 35h-40Z" fill="#FFFFFF" />
      <path d="m120 92 88 148H32Z" fill="#E9993E" />
      <path d="m120 129 66 111H54Z" fill="#EEBA46" />
    </DotTile>
  );
}

function TagalogIcon() {
  return (
    <DotTile label="Tagalog" background="#E26E38">
      <circle cx="208" cy="34" r="88" fill="#F6D64A" />
      <path d="M-18 158 120 42l138 116Z" fill="#A8241C" />
      <path d="M34 147h172v93H34Z" fill="#EFB088" />
      <path d="M94 160h52v80H94Z" fill="#22539F" />
    </DotTile>
  );
}

function KalabawIcon() {
  return (
    <DotTile label="Kalabaw" background="#99C555">
      <circle cx="24" cy="12" r="112" fill="#FCF57E" />
      <circle cx="216" cy="12" r="112" fill="#FCF57E" />
      <path d="M42 47 120 96 198 47l-24 193H66Z" fill="#3B7939" />
      <path d="m79 118 41-30 41 30-20 91H99Z" fill="#EFB088" />
      <circle cx="92" cy="139" r="9" fill="#1D497B" />
      <circle cx="148" cy="139" r="9" fill="#1D497B" />
    </DotTile>
  );
}

function SeaIcon() {
  return (
    <DotTile label="Sea" background="#22539F">
      <circle cx="-16" cy="240" r="222" fill="#86CDF2" />
      <circle cx="-16" cy="240" r="171" fill="#48A0CC" />
      <circle cx="-16" cy="240" r="119" fill="#2E318D" />
      <circle cx="-16" cy="240" r="66" fill="#1D497B" />
    </DotTile>
  );
}

function TarsierIcon() {
  return (
    <DotTile label="Tarsier" background="#5E308B">
      <circle cx="39" cy="120" r="90" fill="#E9993E" />
      <circle cx="201" cy="120" r="90" fill="#EEBA46" />
      <circle cx="65" cy="120" r="43" fill="#1D497B" />
      <circle cx="175" cy="120" r="43" fill="#1D497B" />
      <circle cx="78" cy="104" r="13" fill="#FFFFFF" />
      <circle cx="188" cy="104" r="13" fill="#FFFFFF" />
      <path d="m120 154 28 43H92Z" fill="#DA345D" />
    </DotTile>
  );
}

function MangoIcon() {
  return (
    <DotTile label="Mango" background="#DA345D">
      <ellipse cx="117" cy="152" rx="92" ry="116" transform="rotate(32 117 152)" fill="#EEBA46" />
      <path d="M115 62q37-74 117-52-26 77-117 75Z" fill="#4AA35B" />
      <path d="M38 154Q92 55 166 69 96 108 85 240H22Z" fill="#E9993E" />
    </DotTile>
  );
}

function NarraIcon() {
  return (
    <DotTile label="Narra tree" background="#3B7939">
      <circle cx="30" cy="58" r="92" fill="#99C555" />
      <circle cx="119" cy="23" r="104" fill="#60B258" />
      <circle cx="215" cy="61" r="92" fill="#4AA35B" />
      <path d="m82 240 25-115-45-57 58 34 54-49-38 73 27 114Z" fill="#E26E38" />
      <path d="m105 240 17-102 18 102Z" fill="#EFB069" />
    </DotTile>
  );
}

function DivingIcon({ dark = false }: { dark?: boolean }) {
  return (
    <DotTile label="Diving and sea creature" background={dark ? "#1D497B" : "#3A83A3"}>
      <circle cx="252" cy="122" r="118" fill={dark ? "#22539F" : "#56BCEE"} />
      <path d="M-18 57q80-47 142 12L91 96l34 23-32 22-47-35-64 12Z" fill={dark ? "#EFB088" : "#FFFFFF"} />
      <circle cx="31" cy="78" r="18" fill={dark ? "#E9993E" : "#FBEB4F"} />
      <path d="M106 167q51-51 120 0-69 74-120 0Z" fill={dark ? "#5E308B" : "#2E318D"} />
      <path d="m111 167-45-35v70Z" fill={dark ? "#3B7939" : "#4BA69E"} />
      <circle cx="192" cy="156" r="7" fill="#FFFFFF" />
    </DotTile>
  );
}

function BeachIcon({ dark = false }: { dark?: boolean }) {
  return (
    <DotTile label="Beach and island" background={dark ? "#22539F" : "#86CDF2"}>
      <circle cx="204" cy="34" r="71" fill={dark ? "#E9993E" : "#FBEB4F"} />
      <circle cx="120" cy="260" r="143" fill={dark ? "#902019" : "#EEBA46"} />
      <path d="M88 240 116 92h17l-2 148Z" fill={dark ? "#1D497B" : "#902019"} />
      <path d="M123 102Q63 77 46 29q69 0 86 60Q159 28 217 33q-17 56-86 69Z" fill={dark ? "#3B7939" : "#4AA35B"} />
      <path d="M0 210q55-24 110 0t130 0v30H0Z" fill={dark ? "#2E318D" : "#22539F"} />
    </DotTile>
  );
}

function TrekkingIcon({ dark = false }: { dark?: boolean }) {
  return (
    <DotTile label="Nature mountain and trekking" background={dark ? "#3B7939" : "#4AA35B"}>
      <path d="m-21 240 111-205 111 205Z" fill="#1D497B" />
      <path d="m75 240 99-170 94 170Z" fill={dark ? "#22539F" : "#3A83A3"} />
      <path d="m57 96 33-61 35 65-35-20Z" fill={dark ? "#86CDF2" : "#FFFFFF"} />
      <circle cx="161" cy="128" r="16" fill={dark ? "#E9993E" : "#FBEB4F"} />
      <path d="m151 145-20 49h19l12-25 15 71h21l-12-72 24 21 12-13-43-40Z" fill={dark ? "#902019" : "#DA3731"} />
    </DotTile>
  );
}

function KaraokeIcon({ dark = false }: { dark?: boolean }) {
  return (
    <DotTile label="Karaoke" background={dark ? "#5E308B" : "#DA345D"}>
      <circle cx="74" cy="53" r="70" fill={dark ? "#2E318D" : "#9E67A5"} />
      <circle cx="75" cy="70" r="47" fill={dark ? "#E9993E" : "#FCF57E"} />
      <path d="m87 108 36 22-62 110H10Z" fill="#1D497B" />
      <path d="M127 46q82 22 104 104l-37 9q-16-56-75-75Z" fill={dark ? "#902019" : "#E9993E"} />
      <path d="M144 0q96 30 96 126l-25-1q0-75-78-98Z" fill={dark ? "#EFB088" : "#FFFFFF"} />
    </DotTile>
  );
}

function ShoppingIcon({ dark = false }: { dark?: boolean }) {
  return (
    <DotTile label="Shopping" background={dark ? "#902019" : "#E9993E"}>
      <path d="M23 73h194l-17 167H40Z" fill={dark ? "#A8241C" : "#DA3731"} />
      <path d="M70 86q0-72 50-72t50 72h-29q0-43-21-43T99 86Z" fill={dark ? "#E9993E" : "#FCF57E"} />
      <circle cx="79" cy="154" r="31" fill={dark ? "#1D497B" : "#4BA69E"} />
      <path d="m120 109 46 79H74Z" fill={dark ? "#E26E38" : "#EEBA46"} />
    </DotTile>
  );
}

function WeddingIcon({ dark = false }: { dark?: boolean }) {
  return (
    <DotTile label="Weddings" background={dark ? "#902019" : "#E27580"}>
      <circle cx="88" cy="90" r="69" fill={dark ? "#EFB088" : "#FFFFFF"} />
      <circle cx="152" cy="90" r="69" fill={dark ? "#E27580" : "#F4C891"} />
      <path d="M35 90h170L120 240Z" fill={dark ? "#A8241C" : "#DA3731"} />
      <path d="m120 99 33 45-33 45-33-45Z" fill={dark ? "#E9993E" : "#FBEB4F"} />
    </DotTile>
  );
}

function BusinessIcon({ dark = false }: { dark?: boolean }) {
  return (
    <DotTile label="Meetings and business" background={dark ? "#1D497B" : "#22539F"}>
      <circle cx="45" cy="57" r="39" fill={dark ? "#22539F" : "#86CDF2"} />
      <circle cx="120" cy="42" r="42" fill={dark ? "#E9993E" : "#FCF57E"} />
      <circle cx="195" cy="57" r="39" fill={dark ? "#902019" : "#EFB088"} />
      <path d="M-5 110h250v54H-5Z" fill={dark ? "#2E318D" : "#3A83A3"} />
      <path d="m23 164 42 76H2Zm194 0 21 76h-63Z" fill={dark ? "#3B7939" : "#1D497B"} />
      <path d="M91 164h58v76H91Z" fill={dark ? "#5E308B" : "#4BA69E"} />
    </DotTile>
  );
}

function EducationIcon({ dark = false }: { dark?: boolean }) {
  return (
    <DotTile label="Education and English" background={dark ? "#902019" : "#EEBA46"}>
      <path d="M0 53q58-28 112 13v174Q58 199 0 226Z" fill="#1D497B" />
      <path d="M240 53q-58-28-112 13v174q54-41 112-14Z" fill={dark ? "#22539F" : "#3A83A3"} />
      <circle cx="72" cy="104" r="23" fill={dark ? "#EFB088" : "#FFFFFF"} />
      <path d="m72 124-25 27 9-34Z" fill={dark ? "#EFB088" : "#FFFFFF"} />
      <circle cx="173" cy="109" r="28" fill={dark ? "#E9993E" : "#FCF57E"} />
      <path d="m173 134 29 25-10-36Z" fill={dark ? "#E9993E" : "#FCF57E"} />
    </DotTile>
  );
}

function CultureIcon({ dark = false }: { dark?: boolean }) {
  return (
    <DotTile label="Culture sights church weaves and dancers" background={dark ? "#2E318D" : "#5E308B"}>
      <path d="M61 240V89l59-72 59 72v151Z" fill={dark ? "#902019" : "#E26E38"} />
      <path d="M18 240V142l43-35v133Zm204 0v-98l-43-35v133Z" fill={dark ? "#1D497B" : "#A8241C"} />
      <path d="m120 84 30 42-30 42-30-42Z" fill={dark ? "#E9993E" : "#FBEB4F"} />
      <path d="M104 240v-55q16-31 32 0v55Z" fill={dark ? "#3B7939" : "#2E318D"} />
      <path d="m18 171 43-29 43 29-43 29Zm118 0 43-29 43 29-43 29Z" fill={dark ? "#A8241C" : "#EFB069"} />
    </DotTile>
  );
}

function SpaIcon({ dark = false }: { dark?: boolean }) {
  return (
    <DotTile label="Health and spa" background={dark ? "#1D497B" : "#4BA69E"}>
      <circle cx="120" cy="40" r="63" fill={dark ? "#E9993E" : "#FCF57E"} />
      <ellipse cx="120" cy="161" rx="37" ry="92" fill={dark ? "#EFB088" : "#FFFFFF"} />
      <ellipse cx="79" cy="170" rx="35" ry="78" transform="rotate(-45 79 170)" fill={dark ? "#3B7939" : "#99C555"} />
      <ellipse cx="161" cy="170" rx="35" ry="78" transform="rotate(45 161 170)" fill={dark ? "#4AA35B" : "#60B258"} />
      <path d="M0 214q61-31 120 0t120 0v26H0Z" fill="#2E318D" />
    </DotTile>
  );
}

function HijabIcon({ dark = false }: { dark?: boolean }) {
  return (
    <DotTile label="Woman with hijab" background={dark ? "#5E308B" : "#9E67A5"}>
      <path d="M16 240Q18 16 120 0q102 16 104 240Z" fill="#2E318D" />
      <ellipse cx="120" cy="109" rx="60" ry="78" fill="#EFB088" />
      <path d="M50 105Q64 18 120 9q56 9 70 96l-38-42-32-18-32 18Z" fill={dark ? "#1D497B" : "#3375E7"} />
      <path d="M32 240q28-86 88-86t88 86Z" fill={dark ? "#902019" : "#DA345D"} />
      <circle cx="98" cy="111" r="7" fill="#1D497B" />
      <circle cx="142" cy="111" r="7" fill="#1D497B" />
    </DotTile>
  );
}

function GolfIcon({ dark = false }: { dark?: boolean }) {
  return (
    <DotTile label="Golf" background={dark ? "#1D497B" : "#86CDF2"}>
      <circle cx="34" cy="22" r="69" fill={dark ? "#E9993E" : "#FCF57E"} />
      <path d="M0 137q120-46 240 0v103H0Z" fill={dark ? "#3B7939" : "#99C555"} />
      <path d="M129 26h12v163h-12Z" fill={dark ? "#EFB088" : "#FFFFFF"} />
      <path d="m141 28 74 35-74 35Z" fill={dark ? "#902019" : "#DA3731"} />
      <ellipse cx="135" cy="190" rx="58" ry="17" fill={dark ? "#22539F" : "#3B7939"} />
      <circle cx="65" cy="180" r="25" fill={dark ? "#F4C891" : "#FFFFFF"} />
      <circle cx="58" cy="172" r="3" fill={dark ? "#1D497B" : "#86CDF2"} />
      <circle cx="73" cy="184" r="3" fill={dark ? "#1D497B" : "#86CDF2"} />
    </DotTile>
  );
}

function VibrantDivingIcon() {
  return (
    <DotTile label="Vibrant diving and sea creature" background="#3375E7">
      <circle cx="252" cy="122" r="118" fill="#22539F" />
      <path d="M-18 57q80-47 142 12L91 96l34 23-32 22-47-35-64 12Z" fill="#FBEB4F" />
      <circle cx="31" cy="78" r="18" fill="#22539F" />
      <path d="M106 167q51-51 120 0-69 74-120 0Z" fill="#FBEB4F" />
      <path d="m111 167-45-35v70Z" fill="#22539F" />
      <circle cx="192" cy="156" r="7" fill="#3375E7" />
    </DotTile>
  );
}

function VibrantBeachIcon() {
  return (
    <DotTile label="Vibrant beach and island" background="#56BCEE">
      <circle cx="204" cy="34" r="71" fill="#FBEB4F" />
      <circle cx="120" cy="260" r="143" fill="#FBEB4F" />
      <path d="M88 240 116 92h17l-2 148Z" fill="#DA3731" />
      <path d="M123 102Q63 77 46 29q69 0 86 60Q159 28 217 33q-17 56-86 69Z" fill="#DA3731" />
      <path d="M0 210q55-24 110 0t130 0v30H0Z" fill="#56BCEE" />
    </DotTile>
  );
}

function VibrantTrekkingIcon() {
  return (
    <DotTile label="Vibrant nature mountain and trekking" background="#4AA35B">
      <path d="m-21 240 111-205 111 205Z" fill="#5E308B" />
      <path d="m75 240 99-170 94 170Z" fill="#5E308B" />
      <path d="m57 96 33-61 35 65-35-20Z" fill="#FBEB4F" />
      <circle cx="161" cy="128" r="16" fill="#FBEB4F" />
      <path d="m151 145-20 49h19l12-25 15 71h21l-12-72 24 21 12-13-43-40Z" fill="#FBEB4F" />
    </DotTile>
  );
}

function VibrantKaraokeIcon() {
  return (
    <DotTile label="Vibrant karaoke" background="#DA345D">
      <circle cx="74" cy="53" r="70" fill="#22539F" />
      <circle cx="75" cy="70" r="47" fill="#FBEB4F" />
      <path d="m87 108 36 22-62 110H10Z" fill="#22539F" />
      <path d="M127 46q82 22 104 104l-37 9q-16-56-75-75Z" fill="#FBEB4F" />
      <path d="M144 0q96 30 96 126l-25-1q0-75-78-98Z" fill="#22539F" />
    </DotTile>
  );
}

function VibrantShoppingIcon() {
  return (
    <DotTile label="Vibrant shopping" background="#E9993E">
      <path d="M23 73h194l-17 167H40Z" fill="#DA3731" />
      <path d="M70 86q0-72 50-72t50 72h-29q0-43-21-43T99 86Z" fill="#FBEB4F" />
      <circle cx="79" cy="154" r="31" fill="#FBEB4F" />
      <path d="m120 109 46 79H74Z" fill="#E9993E" />
    </DotTile>
  );
}

function VibrantWeddingIcon() {
  return (
    <DotTile label="Vibrant weddings" background="#E27580">
      <circle cx="88" cy="90" r="69" fill="#FFFFFF" />
      <circle cx="152" cy="90" r="69" fill="#FFFFFF" />
      <path d="M35 90h170L120 240Z" fill="#DA3731" />
      <path d="m120 99 33 45-33 45-33-45Z" fill="#FFFFFF" />
    </DotTile>
  );
}

function VibrantBusinessIcon() {
  return (
    <DotTile label="Vibrant meetings and business" background="#3375E7">
      <circle cx="45" cy="57" r="39" fill="#FBEB4F" />
      <circle cx="120" cy="42" r="42" fill="#DA3731" />
      <circle cx="195" cy="57" r="39" fill="#FBEB4F" />
      <path d="M-5 110h250v54H-5Z" fill="#FBEB4F" />
      <path d="m23 164 42 76H2Zm194 0 21 76h-63Z" fill="#DA3731" />
      <path d="M91 164h58v76H91Z" fill="#3375E7" />
    </DotTile>
  );
}

function VibrantEducationIcon() {
  return (
    <DotTile label="Vibrant education and English" background="#EEBA46">
      <path d="M0 53q58-28 112 13v174Q58 199 0 226Z" fill="#22539F" />
      <path d="M240 53q-58-28-112 13v174q54-41 112-14Z" fill="#22539F" />
      <circle cx="72" cy="104" r="23" fill="#FFFFFF" />
      <path d="m72 124-25 27 9-34Z" fill="#FFFFFF" />
      <circle cx="173" cy="109" r="28" fill="#FFFFFF" />
      <path d="m173 134 29 25-10-36Z" fill="#FFFFFF" />
    </DotTile>
  );
}

function VibrantCultureIcon() {
  return (
    <DotTile label="Vibrant culture sights church weaves and dancers" background="#5E308B">
      <path d="M61 240V89l59-72 59 72v151Z" fill="#E26E38" />
      <path d="M18 240V142l43-35v133Zm204 0v-98l-43-35v133Z" fill="#E26E38" />
      <path d="m120 84 30 42-30 42-30-42Z" fill="#FBEB4F" />
      <path d="M104 240v-55q16-31 32 0v55Z" fill="#5E308B" />
      <path d="m18 171 43-29 43 29-43 29Zm118 0 43-29 43 29-43 29Z" fill="#FBEB4F" />
    </DotTile>
  );
}

function VibrantSpaIcon() {
  return (
    <DotTile label="Vibrant health and spa" background="#4BA69E">
      <circle cx="120" cy="40" r="63" fill="#FCF57E" />
      <ellipse cx="120" cy="161" rx="37" ry="92" fill="#FCF57E" />
      <ellipse cx="79" cy="170" rx="35" ry="78" transform="rotate(-45 79 170)" fill="#FCF57E" />
      <ellipse cx="161" cy="170" rx="35" ry="78" transform="rotate(45 161 170)" fill="#FCF57E" />
      <path d="M0 214q61-31 120 0t120 0v26H0Z" fill="#22539F" />
    </DotTile>
  );
}

function VibrantHijabIcon() {
  return (
    <DotTile label="Vibrant woman with hijab" background="#9E67A5">
      <path d="M16 240Q18 16 120 0q102 16 104 240Z" fill="#3375E7" />
      <ellipse cx="120" cy="109" rx="60" ry="78" fill="#F4C891" />
      <path d="M50 105Q64 18 120 9q56 9 70 96l-38-42-32-18-32 18Z" fill="#3375E7" />
      <path d="M32 240q28-86 88-86t88 86Z" fill="#3375E7" />
      <circle cx="98" cy="111" r="7" fill="#3375E7" />
      <circle cx="142" cy="111" r="7" fill="#3375E7" />
    </DotTile>
  );
}

function VibrantGolfIcon() {
  return (
    <DotTile label="Vibrant golf" background="#86CDF2">
      <circle cx="34" cy="22" r="69" fill="#FBEB4F" />
      <path d="M0 137q120-46 240 0v103H0Z" fill="#4AA35B" />
      <path d="M129 26h12v163h-12Z" fill="#FBEB4F" />
      <path d="m141 28 74 35-74 35Z" fill="#FBEB4F" />
      <ellipse cx="135" cy="190" rx="58" ry="17" fill="#4AA35B" />
      <circle cx="65" cy="180" r="25" fill="#FBEB4F" />
      <circle cx="58" cy="172" r="3" fill="#4AA35B" />
      <circle cx="73" cy="184" r="3" fill="#4AA35B" />
    </DotTile>
  );
}

function PegDivingIcon() {
  return (
    <DotTile label="Peg-style diving and sea creature" background="#56BCEE">
      <path d="M12 98h216v20c0 69-49 108-108 108S12 187 12 118Z" fill="#22539F" />
      <circle cx="30" cy="35" r="11" fill="#FFFFFF" />
      <circle cx="57" cy="57" r="9" fill="#FFFFFF" />
      <circle cx="36" cy="78" r="7" fill="#FFFFFF" />
      <path d="m170 98 38-40 30 40Z" fill="#22539F" />
      <path d="M49 118h28a14 14 0 0 1-28 0Zm45 0h28a14 14 0 0 1-28 0Zm45 0h28a14 14 0 0 1-28 0Zm45 0h28a14 14 0 0 1-28 0ZM72 151h31a15.5 15.5 0 0 1-31 0Zm48 0h31a15.5 15.5 0 0 1-31 0Zm48 0h31a15.5 15.5 0 0 1-31 0Zm-70 34h44a22 22 0 0 1-44 0Z" fill="#56BCEE" />
      <path d="M31 120h27a13.5 13.5 0 0 0-27 0Z" fill="#FFFFFF" />
    </DotTile>
  );
}

function PegBeachIcon() {
  return (
    <DotTile label="Peg-style beach and island" background="#E26E38">
      <circle cx="220" cy="220" r="153" fill="#FFFFFF" />
      <circle cx="220" cy="220" r="131" fill="#F4C891" />
      <path d="M89 240Q110 89 240 71v169Z" fill="#56BCEE" />
      <path d="M-5 240q59-76 123 0Z" fill="#EEBA46" />
      <path d="M46 240 72 94h14L78 240Z" fill="#3B7939" />
      <path d="M78 104Q18 81 7 37q58 0 78 51 22-55 78-47-21 51-85 63Z" fill="#4AA35B" />
    </DotTile>
  );
}

function PegTrekkingIcon() {
  const cells = [
    [47, 48], [103, 48], [159, 48],
    [47, 104], [103, 104], [159, 104],
    [47, 160], [103, 160], [159, 160],
  ] as const;

  return (
    <DotTile label="Peg-style nature mountain and trekking" background="#22539F">
      {cells.map(([x, y], index) => (
        <g key={`${x}-${y}`}>
          <path d={`M${x} ${y}h48v48Z`} fill={index === 8 ? "#FBEB4F" : "#48A0CC"} />
          <path d={`M${x} ${y + 48}h48V${y}Z`} fill={index === 8 ? "#EEBA46" : "#3070B5"} />
        </g>
      ))}
    </DotTile>
  );
}

function PegKaraokeIcon() {
  return (
    <DotTile label="Peg-style karaoke" background="#DA3731">
      <circle cx="218" cy="189" r="133" fill="#FFFFFF" />
      <circle cx="218" cy="189" r="112" fill="#F4C891" />
      <ellipse cx="191" cy="143" rx="24" ry="36" transform="rotate(34 191 143)" fill="#5E308B" />
      <path d="M40 44q54-17 76 30-20 51-76 30Z" fill="#4AA35B" />
      <path d="m81 96 28 18-73 118H7Z" fill="#22539F" />
      <path d="M123 101q40 16 56 53l-28 13q-10-25-39-37Z" fill="#E9993E" />
    </DotTile>
  );
}

function PegShoppingIcon() {
  return (
    <DotTile label="Peg-style shopping" background="#EEBA46">
      <path d="M29 67h147v173H29Z" fill="#DA345D" />
      <path d="M15 67h161v18H30Z" fill="#A8241C" />
      <path d="M46 67a21 21 0 0 1 42 0Zm48 0a21 21 0 0 1 42 0Zm48 0a21 21 0 0 1 42 0Z" fill="#5E308B" />
      <path d="m49 106 23 42 23-42Zm48 0 23 42 23-42Z" fill="#F4C891" />
      <circle cx="189" cy="171" r="75" fill="#FFFFFF" />
      <path d="M189 96a75 75 0 0 1 75 75h-75Z" fill="#E26E38" />
      <path d="M189 171h75a75 75 0 0 1-75 75Z" fill="#ED7051" />
    </DotTile>
  );
}

function PegWeddingIcon() {
  return (
    <DotTile label="Peg-style weddings" background="#99C555">
      <path d="M120 22q35 36 0 86-35-50 0-86Z" fill="#FFFFFF" />
      <path d="M49 54q50-2 59 58-60-8-59-58Zm142 0q1 50-59 58 9-60 59-58ZM32 138q32-39 80-1-40 45-80 1Zm176 0q-40 44-80-1 48-38 80 1ZM78 218q-13-49 44-69 22 56-44 69Zm84 0q-66-13-44-69 57 20 44 69Z" fill="#FFFFFF" />
      <circle cx="120" cy="126" r="19" fill="#E9993E" />
      <circle cx="83" cy="112" r="11" fill="#E9993E" />
      <circle cx="157" cy="112" r="11" fill="#E9993E" />
      <circle cx="96" cy="156" r="11" fill="#E9993E" />
      <circle cx="144" cy="156" r="11" fill="#E9993E" />
    </DotTile>
  );
}

function PegBusinessIcon() {
  return (
    <DotTile label="Peg-style meetings and business" background="#EEBA46">
      <path d="M21 79h142v84H21Z" fill="#DA345D" />
      <path d="m9 79 22 19V79Zm12 84h22l-22 60Zm142 0h-22l22 60Z" fill="#A8241C" />
      <path d="M35 79a19 19 0 0 1 38 0Zm43 0a19 19 0 0 1 38 0Zm43 0a19 19 0 0 1 38 0Z" fill="#5E308B" />
      <path d="m49 101 17 32 17-32Zm42 0 17 32 17-32Zm42 0 17 32 17-32Z" fill="#F4C891" />
      <circle cx="188" cy="172" r="62" fill="#FFFFFF" />
      <path d="M188 110a62 62 0 0 1 62 62h-62Zm0 62h62a62 62 0 0 1-62 62Z" fill="#ED7051" />
    </DotTile>
  );
}

function PegEducationIcon() {
  return (
    <DotTile label="Peg-style education and English" background="#22539F">
      <path d="M29 42h86v78H29Zm96 0h86v78h-86ZM29 130h86v78H29Zm96 0h86v78h-86Z" fill="#3070B5" />
      <path d="M29 42h86L29 120Zm96 78V42h86ZM29 208v-78h86Zm96-78h86l-86 78Z" fill="#48A0CC" />
      <circle cx="120" cy="125" r="29" fill="#FBEB4F" />
      <path d="m120 96 28 29-28 29-28-29Z" fill="#E9993E" />
    </DotTile>
  );
}

function PegCultureIcon() {
  return (
    <DotTile label="Peg-style culture sights church weaves and dancers" background="#99C555">
      <path d="M18 225Q14 46 225 17q4 188-207 208Z" fill="#3B7939" />
      <path d="M69 170q27-70 92-75-12 67-92 75Z" fill="#56BCEE" />
      <path d="m112 95 17-31 17 31-17-11Z" fill="#3375E7" />
      <path d="m52 74 22-15 17 24-28 8Zm91 79 30-9 11 26-30 10Z" fill="#E9993E" />
      <circle cx="175" cy="76" r="17" fill="#DA345D" />
      <circle cx="57" cy="181" r="21" fill="#FFFFFF" />
      <path d="m90 184 18-28 18 28-18 29Z" fill="#FBEB4F" />
      <path d="m143 45 18-20 18 20-18 20Z" fill="#F4C891" />
    </DotTile>
  );
}

function PegSpaIcon() {
  return (
    <DotTile label="Peg-style health and spa" background="#99C555">
      <path d="M120 21q35 36 0 88-35-52 0-88Z" fill="#FFFFFF" />
      <path d="M48 62q53-9 63 51-58 5-63-51Zm144 0q-5 56-63 51 10-60 63-51ZM40 143q35-43 76-2-35 49-76 2Zm160 0q-41 47-76-2 41-41 76 2ZM79 218q-14-52 43-72 21 59-43 72Zm82 0q-64-13-43-72 57 20 43 72Z" fill="#FFFFFF" />
      <path d="M48 62q53-9 63 51-58 5-63-51Zm144 0q-5 56-63 51 10-60 63-51Z" fill="#4AA35B" />
      <circle cx="120" cy="132" r="15" fill="#E9993E" />
      <circle cx="88" cy="119" r="10" fill="#E9993E" />
      <circle cx="152" cy="119" r="10" fill="#E9993E" />
    </DotTile>
  );
}

function PegHijabIcon() {
  return (
    <DotTile label="Peg-style woman with hijab" background="#DA3731">
      <circle cx="224" cy="127" r="145" fill="#F4C891" />
      <path d="M42 240Q37 47 132 16q91 55 82 224Z" fill="#5E308B" />
      <path d="M75 240Q65 79 132 55q60 42 48 185Z" fill="#3375E7" />
      <ellipse cx="132" cy="121" rx="43" ry="55" fill="#FFFFFF" />
      <path d="M15 86q45-35 82 3-38 43-82-3Z" fill="#4AA35B" />
      <circle cx="118" cy="120" r="6" fill="#22539F" />
      <circle cx="146" cy="120" r="6" fill="#22539F" />
    </DotTile>
  );
}

function PegGolfIcon() {
  return (
    <DotTile label="Peg-style golf" background="#EEBA46">
      <circle cx="186" cy="180" r="77" fill="#FFFFFF" />
      <path d="M186 103a77 77 0 0 1 77 77h-77Zm0 77h77a77 77 0 0 1-77 77Z" fill="#4AA35B" />
      <path d="M28 71h135v90H28Z" fill="#DA345D" />
      <path d="m15 71 22 18V71Zm13 90h21l-21 65Z" fill="#A8241C" />
      <path d="m49 96 22 39 22-39Zm43 0 22 39 22-39Z" fill="#F4C891" />
      <path d="M49 71a19 19 0 0 1 38 0Zm44 0a19 19 0 0 1 38 0Zm44 0a19 19 0 0 1 38 0Z" fill="#5E308B" />
    </DotTile>
  );
}

type IconItem =
  | (typeof CULTURAL_ICONS)[number]
  | (typeof EXPERIENCE_ICONS)[number]
  | (typeof DARK_EXPERIENCE_ICONS)[number]
  | (typeof VIBRANT_EXPERIENCE_ICONS)[number]
  | (typeof PEG_EXPERIENCE_ICONS)[number];

function IconGrid({ items, startAt = 1 }: { items: readonly IconItem[]; startAt?: number }) {
  return (
    <div className="mt-6 grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item, index) => (
        <article key={item.name} className="group min-w-0">
          <div className="aspect-square overflow-hidden bg-white/5 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
            <div className="h-full w-full transition duration-500 ease-out group-hover:scale-[1.025]">{item.icon}</div>
          </div>
          <div className="mt-4 flex gap-4 border-t border-white/10 pt-4">
            <span className="pt-1 font-mono text-[9px] font-bold tracking-[0.18em] text-white/25">
              {String(startAt + index).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <h3 className="text-xl font-black leading-tight tracking-[-0.025em]">{item.name}</h3>
              <p className="mt-1 font-mono text-[9px] uppercase leading-4 tracking-[0.14em] text-white/35">{item.subtitle}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function LogoPrototypePage() {
  return (
    <main className="min-h-screen bg-black px-5 py-8 text-white sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col gap-8 border-b border-white/10 pb-9 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/proto" className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-white/35 transition hover:text-white">← Prototype lab</Link>
            <p className="mt-8 font-mono text-[10px] font-bold uppercase tracking-[0.34em] text-[#EEBA46]">DOT-inspired identity system</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-[-0.045em] sm:text-6xl lg:text-7xl">Big stories,<br />built from bold shapes.</h1>
          </div>
          <div className="max-w-md">
            <p className="text-sm leading-6 text-white/50">A modular icon family using edge-to-edge color, oversized geometry, and simple forms that remain readable from across a room.</p>
            <div className="mt-5 grid grid-cols-10 overflow-hidden">
              {PALETTE.map((color) => <span key={color} className="h-3" style={{ backgroundColor: color }} title={color} />)}
            </div>
          </div>
        </header>

        <section className="pt-12" aria-labelledby="cultural-heading">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#99C555]">Collection 01</p>
          <h2 id="cultural-heading" className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-4xl">Cultural &amp; natural symbols</h2>
          <IconGrid items={CULTURAL_ICONS} />
        </section>

        <section className="mt-20 border-t border-white/10 pt-12" aria-labelledby="experience-heading">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#56BCEE]">Collection 02</p>
          <h2 id="experience-heading" className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-4xl">Experiences, travel &amp; everyday life</h2>
          <IconGrid items={EXPERIENCE_ICONS} startAt={CULTURAL_ICONS.length + 1} />
        </section>

        <section className="mt-20 border-t border-white/10 pt-12" aria-labelledby="dark-experience-heading">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#E9993E]">Collection 03</p>
          <h2 id="dark-experience-heading" className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-4xl">Experiences in the dark palette</h2>
          <IconGrid
            items={DARK_EXPERIENCE_ICONS}
            startAt={CULTURAL_ICONS.length + EXPERIENCE_ICONS.length + 1}
          />
        </section>

        <section className="mt-20 border-t border-white/10 pt-12" aria-labelledby="vibrant-experience-heading">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#FBEB4F]">Collection 04</p>
          <h2 id="vibrant-experience-heading" className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-4xl">Experiences in fewer, brighter colors</h2>
          <IconGrid
            items={VIBRANT_EXPERIENCE_ICONS}
            startAt={CULTURAL_ICONS.length + EXPERIENCE_ICONS.length + DARK_EXPERIENCE_ICONS.length + 1}
          />
        </section>

        <section className="mt-20 border-t border-white/10 pt-12" aria-labelledby="peg-experience-heading">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#99C555]">Collection 05</p>
          <h2 id="peg-experience-heading" className="mt-2 text-3xl font-black tracking-[-0.035em] sm:text-4xl">Experiences closest to the DOT peg</h2>
          <IconGrid
            items={PEG_EXPERIENCE_ICONS}
            startAt={CULTURAL_ICONS.length + EXPERIENCE_ICONS.length + DARK_EXPERIENCE_ICONS.length + VIBRANT_EXPERIENCE_ICONS.length + 1}
          />
        </section>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-6 font-mono text-[9px] uppercase tracking-[0.18em] text-white/25">
          <span>55 symbols · one geometric language</span>
          <span>Full-bleed color / oversized shapes / black field</span>
        </footer>
      </div>
    </main>
  );
}
