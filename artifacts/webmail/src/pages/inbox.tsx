import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { Copy, RefreshCw, Inbox, Shuffle, Check, Radio, Search, X, Trash2, Sparkles } from "lucide-react";
import { useListEmails, useListDomains, useGetEmailStats } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserTier } from "@/hooks/use-user-tier";

const AUTO_REFRESH_INTERVAL = 15000;
const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || "";

const DOMAIN_ACCENT = [
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-blue-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-500",
  "from-slate-500 to-slate-700",
];

export function InboxPage() {
  const [, setLocation] = useLocation();
  const { allowedDomainIds } = useUserTier();

  const [alias, setAlias] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("");
  const [activeAddress, setActiveAddress] = useState("");
  const [copied, setCopied] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [search, setSearch] = useState("");
  const [clearing, setClearing] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const { data: domainsData } = useListDomains();
  const allDomains = domainsData?.domains ?? [];

  const domains = allowedDomainIds.length > 0
    ? allDomains.filter(d => allowedDomainIds.includes(d.id))
    : allDomains;

  useEffect(() => {
    if (!domains.length) return;
    const stillValid = domains.some(d => d.name === selectedDomain);
    if (!stillValid) setSelectedDomain(domains[0].name);
  }, [domains]);

  const {
    data: emailsData,
    isLoading: isLoadingEmails,
    refetch: refetchEmails,
    isRefetching,
  } = useListEmails(
    { address: activeAddress },
    {
      query: {
        enabled: !!activeAddress,
        queryKey: ["/api/emails", { address: activeAddress }],
      },
    }
  );

  const { data: statsData } = useGetEmailStats(
    { address: activeAddress },
    {
      query: {
        enabled: !!activeAddress,
        queryKey: ["/api/emails/stats", { address: activeAddress }],
      },
    }
  );

  const doRefetch = useCallback(() => {
    if (activeAddress) refetchEmails();
  }, [activeAddress, refetchEmails]);

  // SSE real-time connection
  useEffect(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
      setLiveConnected(false);
    }
    if (!activeAddress) return;

    const url = `${apiBase}/api/events?address=${encodeURIComponent(activeAddress)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("connected", () => setLiveConnected(true));

    es.addEventListener("new-email", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as { to: string; id: number };
        if (data.to.toLowerCase() === activeAddress.toLowerCase()) refetchEmails();
      } catch {
        refetchEmails();
      }
    });

    es.onerror = () => setLiveConnected(false);

    return () => {
      es.close();
      esRef.current = null;
      setLiveConnected(false);
    };
  }, [activeAddress, refetchEmails]);

  const generatePrefix = () => {
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

    const firstNames = ["Aaron","Ada","Adam","Alex","Alice","Amber","Amelia","Amy","Andre","Andrew","Angel","Anna","Anton","April","Arthur","Ashley","Aurora","Austin","Ava","Axel","Bella","Ben","Blake","Boris","Brady","Brian","Brooke","Bruce","Bryan","Caleb","Calvin","Cara","Carl","Chloe","Chris","Clara","Cole","Colin","Connor","Craig","Dana","Daniel","David","Dean","Diana","Diego","Donna","Drake","Dylan","Eden","Elias","Elise","Ella","Emily","Emma","Eric","Erin","Ethan","Eva","Evan","Felix","Finn","Flora","Frank","Glen","Gloria","Grace","Grant","Hailey","Hannah","Harry","Harvey","Hazel","Heath","Henry","Holly","Hope","Hugo","Hunter","Ian","Iris","Ivan","Jack","Jacob","Jake","James","Jamie","Jane","Jason","Jesse","Joel","Jonas","Jordan","Josh","Julia","Julian","Karen","Kate","Kelly","Kevin","Kylie","Laura","Lauren","Leo","Leon","Lewis","Lily","Logan","Luca","Luke","Luna","Marc","Maria","Mark","Martin","Mason","Matt","Max","Maya","Megan","Miles","Milo","Molly","Nathan","Nora","Olivia","Oscar","Owen","Paige","Paul","Peter","Quinn","Rachel","Ray","Reid","Rex","Rob","Robin","Rose","Ross","Ruby","Ryan","Sam","Sara","Scott","Sean","Seth","Simon","Sophie","Stella","Steve","Tara","Tess","Thomas","Tim","Todd","Tom","Tyler","Vera","Victor","Vivian","Wade","Wayne","Will","Zoe"];
    const lastNames = ["Abbott","Adler","Aldrich","Archer","Ardley","Armour","Ashby","Ashton","Atkins","Avery","Bailey","Baker","Baldwin","Barker","Barnes","Barton","Beckett","Bell","Benson","Blake","Bolton","Bowen","Boyd","Bradford","Brady","Brewer","Brooks","Burke","Burton","Butler","Byrne","Calder","Caldwell","Carey","Carver","Chambers","Chandler","Chase","Clarke","Clifton","Collins","Conner","Conway","Cooper","Cornell","Cotton","Crane","Crawford","Croft","Crosby","Cross","Cullen","Curtis","Dalton","Darby","Dawson","Dixon","Drake","Draper","Drummond","Dunbar","Duncan","Eaton","Eldoria","Ellis","Emerson","Evans","Fairfax","Fallon","Fenton","Ferguson","Fields","Finch","Fisher","Flint","Flynn","Forbes","Ford","Foster","Fowler","Francis","Franklin","Fraser","Frost","Fuller","Gable","Galway","Garner","Gates","Gibson","Giles","Gilmore","Glover","Gordon","Grant","Graves","Greene","Griffith","Grove","Hale","Harding","Hardy","Harlow","Harper","Harris","Hart","Hartley","Harvey","Hayden","Hayes","Heath","Hemming","Heron","Hewitt","Hilton","Holden","Holland","Holmes","Holt","Hooper","Horton","Howard","Hudson","Hughes","Hurst","Irving","Jacobs","Jensen","Jordan","Kane","Keane","Keller","Kelley","Kent","Kirby","Knox","Laird","Lawson","Layton","Leonard","Lester","Lewis","Linton","Lloyd","Logan","Lowe","Lyons","Manning","Marsh","Marshall","Mason","Maxwell","Mayer","Mercer","Miller","Mitchell","Monroe","Moore","Morgan","Morris","Morton","Munroe","Neville","Newton","Nolan","Norris","Norton","Oliver","Olsen","Page","Palmer","Parker","Payne","Penn","Perkins","Perry","Pierce","Porter","Preston","Price","Quinn","Raines","Ramsey","Reed","Rhodes","Riggs","Riley","Rowe","Rowley","Russel","Ryker","Saunders","Saxon","Shelby","Sheldon","Sherwood","Simmons","Sloane","Spencer","Sterling","Stone","Sutton","Swift","Taylor","Thorne","Thornton","Tilden","Travis","Turner","Vance","Vega","Voss","Walker","Walton","Ward","Warren","Watts","Webb","Wells","Weston","Wilkins","Willis","Winter","Wolfe","Wood"];
    const adjectives = ["Angry","Blazing","Breezy","Bright","Broken","Calm","Chunky","Clever","Clumsy","Cosmic","Cozy","Crazy","Creaky","Crispy","Crusty","Dark","Dazed","Dizzy","Dreamy","Dusty","Electric","Endless","Epic","Eternal","Faded","Fancy","Fluffy","Flying","Foggy","Frozen","Funky","Fuzzy","Gentle","Giant","Gloomy","Golden","Grumpy","Happy","Heavy","Hollow","Icy","Jolly","Jumpy","Lazy","Little","Lively","Lonely","Lost","Lucky","Mad","Misty","Moody","Mystic","Naughty","Noisy","Numb","Nutty","Odd","Pastel","Phat","Plump","Puffy","Purple","Quiet","Rapid","Restless","Rosy","Rusty","Salty","Savage","Shadowy","Shiny","Silly","Sleepy","Slick","Slim","Sly","Sneaky","Soft","Spicy","Spooky","Stale","Stony","Strange","Sugar","Sunny","Super","Sweet","Swift","Tangy","Tasty","Tiny","Tired","Toxic","Twisted","Ultra","Velvet","Vivid","Wild","Windy","Witty","Woozy","Zippy"];
    const nouns = ["Anchor","Angel","Apple","Arrow","Atom","Axe","Badge","Baron","Barrel","Basil","Bear","Beast","Berry","Bird","Blade","Blaze","Bloom","Boot","Bottle","Brain","Branch","Brick","Bridge","Bull","Butter","Button","Canyon","Castle","Cave","Cedar","Chain","Chef","Cloud","Cobalt","Comet","Cookie","Coral","Crown","Dagger","Dawn","Delta","Demon","Dew","Diamond","Dusk","Eagle","Echo","Edge","Elder","Ember","Falcon","Fang","Feather","Flame","Flash","Flint","Fog","Forest","Fox","Frost","Fungus","Gear","Gel","Ghost","Ginger","Glacier","Glass","Goblin","Gold","Gorge","Grape","Hammer","Hawk","Haze","Head","Hero","Hill","Honey","Horn","Hurricane","Idol","Island","Ivy","Jaguar","Jet","Juice","Jungle","Key","Knight","Lantern","Lemon","Light","Lion","Log","Lotus","Magnet","Maple","Marble","Marsh","Mist","Monk","Moon","Mountain","Mud","Nectar","Night","Nova","Oak","Ocean","Orb","Panda","Pearl","Petal","Pine","Planet","Plum","Pond","Portal","Prism","Pumpkin","Rain","Raven","Ridge","Ring","River","Rock","Root","Rose","Rune","Sage","Sand","Shadow","Shell","Shield","Ship","Shore","Silk","Silver","Sky","Skull","Slate","Smoke","Snow","Spark","Spider","Spirit","Spring","Star","Steam","Stone","Storm","Stream","Summer","Summit","Sun","Sword","Tiger","Titan","Tower","Trail","Tree","Tundra","Vale","Vapor","Vault","Vine","Volcano","Wave","Wind","Wing","Winter","Wolf","Wood","Wraith","Zephyr"];
    const compounds = ["Afterglow","Backbone","Barefoot","Beehive","Birdsong","Blackout","Bluebell","Bonfire","Brainwave","Breakdown","Brimstone","Candlelight","Clearwater","Cobblestone","Crossroads","Daydream","Deadwood","Driftwood","Duskfall","Dustcloud","Evergreen","Fadeout","Fairwind","Firestorm","Firstlight","Fogbank","Frostbite","Glowworm","Goldrush","Halfmoon","Hangover","Hardrock","Heartbeat","Heatwave","Highwind","Hollowpoint","Homerun","Houndstooth","Iceberg","Ironclad","Jetstream","Keepsake","Keystone","Kindling","Knifepoint","Lastlight","Laughtrack","Leftover","Limelight","Lockdown","Longroad","Lovebird","Lowrider","Lukewarm","Lullaby","Midnight","Milkweed","Moondust","Moonrise","Mudslide","Nightfall","Northstar","Offshore","Outrider","Overcast","Overload","Paperdoll","Patchwork","Pearlwhite","Pinecone","Pitchblack","Quicksand","Raindrop","Rainwater","Redwood","Ridgeline","Riverside","Roadblock","Rockslide","Rooftop","Saltwater","Sandstorm","Scarecrow","Seafoam","Seawall","Shipwreck","Shortwave","Sidetrack","Silverbell","Skyfall","Skylark","Sleepyhead","Slowburn","Snowfall","Snowstorm","Starfall","Stardust","Starlight","Stormcloud","Streamline","Sundown","Sunflower","Sunrise","Sunshine","Swiftwater","Swordfish","Tailwind","Tidewater","Timberfall","Timberwolf","Tombstone","Topsoil","Torchlight","Trailblaze","Triggerfish","Tumbledown","Undertow","Undying","Upswing","Velvethorn","Warpaint","Watershed","Wavecrest","Whirlpool","Whirlwind","Wildfire","Wildwood","Windfall","Windmill","Winterfell","Wishbone","Witchcraft","Wolfpack","Woodsmoke","Yardsale"];

    const style = Math.floor(Math.random() * 5);
    if (style === 0) return pick(firstNames) + pick(lastNames);
    if (style === 1) return pick(adjectives) + pick(nouns);
    if (style === 2) return "The" + pick(nouns) + pick(nouns);
    if (style === 3) return pick(compounds);
    return pick(adjectives) + pick(nouns) + String(Math.floor(Math.random() * 99) + 1);
  };

  const openInbox = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const domain = selectedDomain || domains[0]?.name;
    if (!domain) return;
    const prefix = alias.trim().toLowerCase() || generatePrefix();
    const addr = `${prefix}@${domain}`;
    setAlias(prefix);
    setActiveAddress(addr);
  };

  const handleShuffle = () => {
    const domain = selectedDomain || domains[0]?.name;
    if (!domain) return;
    const prefix = generatePrefix();
    setAlias(prefix);
    setActiveAddress(`${prefix}@${domain}`);
  };

  const handleCopy = () => {
    if (!activeAddress) return;
    navigator.clipboard.writeText(activeAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearInbox = async () => {
    if (!activeAddress) return;
    if (!confirm(`Delete all messages in ${activeAddress}? This cannot be undone.`)) return;
    setClearing(true);
    try {
      await fetch(`${apiBase}/api/emails?address=${encodeURIComponent(activeAddress)}`, { method: "DELETE" });
      refetchEmails();
    } catch {
      // silently ignore
    } finally {
      setClearing(false);
    }
  };

  const deleteInbox = async () => {
    if (!activeAddress) return;
    if (!confirm(`Delete inbox "${activeAddress}" and all its messages? You'll return to the inbox picker.`)) return;
    setClearing(true);
    try {
      await fetch(`${apiBase}/api/emails?address=${encodeURIComponent(activeAddress)}`, { method: "DELETE" });
    } catch {
      // silently ignore
    } finally {
      setClearing(false);
      setActiveAddress("");
      setAlias("");
    }
  };

  const allEmails = emailsData?.emails ?? [];
  const unread = statsData?.unreadEmails ?? 0;

  const emails = search.trim()
    ? allEmails.filter((e) => {
        const q = search.toLowerCase();
        return (
          e.from?.toLowerCase().includes(q) ||
          e.subject?.toLowerCase().includes(q) ||
          e.preview?.toLowerCase().includes(q)
        );
      })
    : allEmails;

  const activeDomain = selectedDomain || domains[0]?.name || "";
  const activeDomainIdx = Math.max(0, domains.findIndex(d => d.name === activeDomain));
  const accentGradient = DOMAIN_ACCENT[activeDomainIdx % DOMAIN_ACCENT.length];

  const extractCode = (e: { subject?: string; preview?: string }) => {
    const text = [e.subject, e.preview].join(" ");
    return text.match(/\b(\d{4,8})\b/)?.[1] ?? null;
  };

  return (
    <div className="h-full flex flex-col min-h-[100dvh] bg-muted/30">

      {/* Header banner */}
      <div className={`bg-gradient-to-r ${accentGradient} px-5 py-5 text-white`}>
        <div className="max-w-lg mx-auto flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Sparkles className="w-4 h-4 opacity-80" />
              <span className="text-xs font-semibold tracking-widest uppercase opacity-80">Premium</span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">WEYN EMAILS</h1>
          </div>
          <div className="flex flex-col items-end gap-2 pt-0.5">
            <div className="flex items-center gap-1.5">
              {liveConnected && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white/20 rounded-full px-2.5 py-0.5">
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  Live
                </span>
              )}
              {unread > 0 && (
                <span className="inline-flex items-center text-[11px] font-bold bg-white/30 rounded-full px-2.5 py-0.5">
                  {unread} new
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Domain pills */}
      <div className="bg-white dark:bg-card border-b border-border px-5 py-3">
        <div className="max-w-lg mx-auto flex gap-2 flex-wrap">
          {domains.map((d, idx) => {
            const isActive = activeDomain === d.name;
            const grad = DOMAIN_ACCENT[idx % DOMAIN_ACCENT.length];
            return (
              <button
                key={d.id}
                onClick={() => {
                  setSelectedDomain(d.name);
                  if (activeAddress && alias) setActiveAddress(`${alias}@${d.name}`);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold font-mono transition-all border ${
                  isActive
                    ? `bg-gradient-to-r ${grad} text-white border-transparent shadow-sm`
                    : "bg-background text-muted-foreground border-border hover:border-violet-300 dark:hover:border-violet-700 hover:text-foreground"
                }`}
              >
                @{d.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Address card */}
      <div className="px-5 pt-4 pb-2">
        <div className="max-w-lg mx-auto">
          <div className="bg-white dark:bg-card rounded-2xl shadow-sm border border-border overflow-hidden">

            <button
              onClick={activeAddress ? handleCopy : undefined}
              disabled={!activeAddress}
              className={`w-full px-5 py-4 text-center border-b border-border transition-colors ${
                activeAddress ? "hover:bg-muted/40 cursor-pointer" : "cursor-default"
              }`}
            >
              <p className={`font-mono font-bold text-base break-all leading-snug transition-colors ${
                activeAddress
                  ? "text-foreground"
                  : alias
                    ? "text-foreground/70"
                    : "text-muted-foreground/40"
              }`}>
                {activeAddress
                  ? activeAddress
                  : alias
                    ? `${alias}@${activeDomain}`
                    : `username@${activeDomain}`}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-center gap-1">
                {activeAddress
                  ? copied
                    ? <><Check className="w-3 h-3 text-emerald-500" /><span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied to clipboard</span></>
                    : <><Copy className="w-3 h-3" />Tap to copy</>
                  : alias
                    ? "Tap Open Inbox to access this address"
                    : "Type a username below to get started"}
              </p>
            </button>

            <div className="px-4 py-4 space-y-3">
              <Input
                type="text"
                placeholder="e.g. arvinm1993"
                value={alias}
                onChange={(e) => {
                  const val = e.target.value.toLowerCase();
                  if (val.includes("@")) {
                    const atIdx = val.indexOf("@");
                    const a = val.slice(0, atIdx).replace(/[^a-z0-9._+-]/g, "");
                    const d = val.slice(atIdx + 1);
                    setAlias(a);
                    const matched = domains.find(dom => dom.name === d);
                    if (matched) setSelectedDomain(matched.name);
                  } else {
                    setAlias(val.replace(/[^a-z0-9._+-]/g, ""));
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData("text").trim().toLowerCase();
                  if (pasted.includes("@")) {
                    const atIdx = pasted.indexOf("@");
                    const a = pasted.slice(0, atIdx).replace(/[^a-z0-9._+-]/g, "");
                    const d = pasted.slice(atIdx + 1);
                    setAlias(a);
                    const matched = domains.find(dom => dom.name === d);
                    if (matched) setSelectedDomain(matched.name);
                  } else {
                    setAlias(pasted.replace(/[^a-z0-9._+-]/g, ""));
                  }
                }}
                className="h-11 text-sm font-mono bg-muted/40 border-border focus-visible:ring-violet-500"
                onKeyDown={(e) => e.key === "Enter" && openInbox()}
              />
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={openInbox}
                  className={`h-11 rounded-lg font-bold text-sm text-white bg-gradient-to-r ${accentGradient} hover:opacity-90 transition-opacity shadow-sm`}
                >
                  Open Inbox
                </button>
                <button
                  onClick={handleShuffle}
                  className="h-11 rounded-lg font-bold text-sm border border-border bg-background hover:bg-muted transition-colors flex items-center justify-center gap-2"
                >
                  <Shuffle className="w-4 h-4" />
                  Random
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live inbox */}
      <div className="flex-1 overflow-auto px-5 pb-8 pt-4">
        <div className="max-w-lg mx-auto">

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground">Live Inbox</h2>
            <div className="flex items-center gap-2">
              {activeAddress && allEmails.length > 0 && (
                <button onClick={clearInbox} disabled={clearing}
                  className="text-[11px] text-muted-foreground hover:text-red-500 transition-colors font-medium">
                  {clearing ? "Clearing…" : "Clear all"}
                </button>
              )}
              <button
                onClick={doRefetch}
                disabled={!activeAddress || isLoadingEmails || isRefetching}
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all ${
                  isRefetching
                    ? "text-muted-foreground border-border"
                    : `bg-gradient-to-r ${accentGradient} text-white border-transparent shadow-sm hover:opacity-90`
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${isRefetching ? "animate-spin" : ""}`} />
                Update
              </button>
            </div>
          </div>

          {activeAddress && allEmails.length > 0 && (
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input placeholder="Search messages…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-8 h-9 text-xs bg-white dark:bg-card" />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {isLoadingEmails ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl bg-white dark:bg-card border border-border p-4 flex gap-3 shadow-sm">
                  <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2 pt-0.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : !activeAddress ? (
            <div className="rounded-2xl bg-white dark:bg-card border border-border py-12 flex flex-col items-center text-center px-4 shadow-sm">
              <Inbox className="w-8 h-8 text-muted-foreground/25 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">No inbox open</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Enter a username and tap Open Inbox</p>
            </div>
          ) : allEmails.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-card border border-border py-12 flex flex-col items-center text-center px-4 shadow-sm">
              <Inbox className="w-8 h-8 text-muted-foreground/25 mb-3" />
              <p className="text-sm font-semibold">Inbox is empty</p>
              <p className="text-xs text-muted-foreground mt-1">
                Waiting at <span className="font-mono text-foreground">{activeAddress}</span>
              </p>
            </div>
          ) : emails.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-card border border-border py-10 flex flex-col items-center text-center px-4 shadow-sm">
              <Search className="w-7 h-7 text-muted-foreground/25 mb-3" />
              <p className="text-sm font-semibold">No results for "{search}"</p>
              <button onClick={() => setSearch("")} className="text-xs text-violet-600 dark:text-violet-400 hover:underline mt-1">Clear</button>
            </div>
          ) : (
            <div className="space-y-2">
              {emails.map((email) => {
                const code = extractCode(email);
                return (
                  <div
                    key={email.id}
                    className={`rounded-2xl border cursor-pointer transition-all shadow-sm flex gap-3 p-4 ${
                      !email.read
                        ? "bg-white dark:bg-card border-violet-200 dark:border-violet-800"
                        : "bg-white dark:bg-card border-border hover:border-border/80"
                    } hover:shadow-md`}
                    onClick={() => setLocation(`/email/${email.id}?address=${encodeURIComponent(activeAddress)}`)}
                  >
                    <div className="relative shrink-0">
                      {!email.read && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-violet-500 border-2 border-white dark:border-card" />
                      )}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                        !email.read
                          ? `bg-gradient-to-br ${accentGradient} text-white`
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {email.from?.charAt(0)?.match(/[a-z]/i) ? email.from.charAt(0).toUpperCase() : "?"}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5 gap-2">
                        <span className={`truncate text-xs font-semibold ${!email.read ? "text-foreground" : "text-foreground/70"}`}>
                          {email.from}
                        </span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                          {formatDistanceToNow(new Date(email.date), { addSuffix: true })}
                        </span>
                      </div>
                      <p className={`text-xs truncate mb-1.5 ${!email.read ? "font-semibold text-foreground" : "text-foreground/80"}`}>
                        {email.subject || "(No Subject)"}
                      </p>
                      {code ? (
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-sm font-bold tracking-widest bg-gradient-to-r ${accentGradient} text-white shadow-sm`}>
                            {code}
                          </span>
                          <button
                            className="text-[10px] font-semibold text-muted-foreground hover:text-violet-600 transition-colors uppercase tracking-wide"
                            onClick={(ev) => { ev.stopPropagation(); navigator.clipboard.writeText(code); }}
                          >
                            Copy
                          </button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground truncate">{email.preview || "No preview."}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeAddress && (
            <button onClick={deleteInbox} disabled={clearing}
              className="mt-5 w-full text-xs text-muted-foreground/50 hover:text-red-400 transition-colors py-2 text-center">
              {clearing ? "Deleting…" : "Delete this inbox"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
