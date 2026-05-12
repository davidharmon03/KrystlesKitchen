import { useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { firstName } from '../utils/userName'
import {
  HelpCircle, ChefHat, DollarSign, Package, Leaf, Wrench, Tag,
  Calendar, Camera, ArrowLeftRight, Bell, User, Mail,
  CheckCircle, ChevronDown, ChevronUp, Search, Lightbulb
} from 'lucide-react'

const sections = [
  { id: 'getting-started',  label: 'Getting Started',    icon: CheckCircle    },
  { id: 'kitchen',          label: 'Your Kitchen',        icon: ChefHat        },
  { id: 'korner',           label: 'Your Corner',         icon: DollarSign     },
  { id: 'kuzine',           label: 'Your Cuisine',        icon: Package        },
  { id: 'kultivate',        label: 'Your Garden',         icon: Leaf           },
  { id: 'equipment',        label: 'Equipment',           icon: Wrench         },
  { id: 'meal-swap',        label: 'Entrée Swap',         icon: ArrowLeftRight },
  { id: 'calendar',         label: 'Group Calendar',      icon: Calendar       },
  { id: 'gallery',          label: 'Entrée Gallery',      icon: Camera         },
  { id: 'product-catalog',  label: 'Product Catalog',     icon: Search         },
  { id: 'notifications',    label: 'Notifications',       icon: Bell           },
  { id: 'digest',           label: 'Weekly Digest',       icon: Mail           },
  { id: 'labels',           label: 'Label Generator',     icon: Tag            },
  { id: 'profile',          label: 'Profile & Account',   icon: User           },
  { id: 'tips',             label: 'Tips',                icon: Lightbulb      },
]

function Section({ id, icon: Icon, title, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div id={id} className="card scroll-mt-6">
      <button
        className="w-full flex items-center gap-3 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <div className="w-8 h-8 rounded-lg bg-moss-100 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-moss-600" />
        </div>
        <h2 className="font-serif font-semibold text-ink text-lg flex-1">{title}</h2>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && (
        <div className="mt-4 pl-11 prose prose-sm max-w-none text-slate-600 leading-relaxed space-y-3">
          {children}
        </div>
      )}
    </div>
  )
}

function P({ children }) {
  return <p className="text-sm text-slate-600 leading-relaxed">{children}</p>
}
function H({ children }) {
  return <h3 className="font-semibold text-ink text-sm mt-4 mb-1">{children}</h3>
}
function Tip({ children }) {
  return (
    <div className="flex items-start gap-2 bg-moss-50 border border-moss-200 rounded-lg px-3 py-2 text-sm text-moss-800">
      <span className="flex-shrink-0 mt-0.5">💡</span>
      <span>{children}</span>
    </div>
  )
}

export default function Help() {
  const { user } = useAuth()
  const name = firstName(user)
  const navRef = useRef(null)

  const scroll = id => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="section-header mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-moss-100 flex items-center justify-center">
            <HelpCircle size={20} className="text-moss-600" />
          </div>
          <div>
            <h1 className="page-title">Help & Guide</h1>
            <p className="text-sm text-slate-500">Everything you need to know about the Hub</p>
          </div>
        </div>
      </div>

      {/* Jump-to nav */}
      <div className="card mb-6 bg-moss-50 border-moss-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Jump to a section</p>
        <div className="flex flex-wrap gap-2" ref={navRef}>
          {sections.map(s => (
            <button key={s.id} onClick={() => scroll(s.id)}
              className="flex items-center gap-1.5 text-xs font-medium text-moss-700 bg-white border border-moss-200 hover:border-moss-400 px-2.5 py-1.5 rounded-lg transition-colors">
              <s.icon size={11} />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">

        <Section id="getting-started" icon={CheckCircle} title="Getting Started">
          <P>Welcome to the Hub — a shared space for your cooking group to manage recipes, track finances, coordinate grocery runs, and tend your garden together. Here's how to get up and running.</P>
          <H>Create an account</H>
          <P>Head to /register and enter your name, email, and a password. No email verification required — you'll land on the Dashboard immediately.</P>
          <H>Create or join a group</H>
          <P>The Hub is built around groups of up to 5 members. From the Dashboard, you can create a new group (give it a name and grab the invite code) or join an existing one by entering an invite code. Every feature — recipes, the Swap calendar, finances — is scoped to your group, so everyone sees the same shared data.</P>
          <H>Invite your people</H>
          <P>Once you've created a group, go to your group settings and send email invitations directly from the Hub. If the recipient already has an account they'll be added instantly; if not, they'll get a link to register and join in one step. Your group's invite code is always visible in the sidebar under "Active Group" if you'd rather share it directly.</P>
          <Tip>Groups max out at 5 members. If you need to remove someone, a group admin can do that from group settings.</Tip>
        </Section>

        <Section id="kitchen" icon={ChefHat} title={`${name}'s Kitchen — Recipes & Cooking`}>
          <P>{name}'s Kitchen is your personal and group recipe library. Every recipe can be public (visible to all Hub users) or group-only.</P>
          <H>Adding a recipe</H>
          <P>Click "New Recipe" in the top-right corner. Fill in the title, description, ingredients (one per line), and steps (one per line). Tag it with recipe tags like "freezer-friendly" or "vegan," and skill tags like "batch prep" or "vacuum seal." Toggle it public if you want the wider community to see it.</P>
          <H>Tags</H>
          <P>Recipe tags categorize what a dish is — "vegan," "gluten-free," "freezer meal," and so on. Skill tags flag the technique involved: "flash freeze," "sous vide," "ferment," "dehydrate," "vacuum seal." Skill tags are filterable so you can quickly pull up all your vacuum-seal–ready recipes at once.</P>
          <H>Adding photos</H>
          <P>Open any recipe and scroll to the Photos section. Upload shots in one of three stages: Plated (the final dish), Stored (portioned and labeled, ready for the freezer or fridge), or Prep (mid-process). The first photo you upload becomes the recipe card thumbnail. Photos also appear in the Entrée Gallery.</P>
          <H>Add to Shopping List</H>
          <P>While viewing a recipe (not in edit mode), hit "Add to Shopping List" at the bottom. A modal lets you pick which shopping list to add to and choose a serving multiplier (1×, 2×, 3×, or 5×). Every ingredient gets parsed and added — if any match products in the catalog they'll be auto-categorized by store section.</P>
        </Section>

        <Section id="korner" icon={DollarSign} title={`${name}'s Corner — Group Finance Hub`}>
          <P>{name}'s Corner is where your group keeps tabs on who paid for what. It has three tabs: Receipts, The Equalizer, and Meal Credits.</P>
          <H>Receipts</H>
          <P>Any member can log a receipt — enter the amount, a short description, and optionally upload a photo of the receipt. Every purchase lives here chronologically. Photos are stored and viewable from the receipt card.</P>
          <H>The Equalizer</H>
          <P>The Equalizer crunches all logged receipts and shows you exactly who owes whom and how much. It auto-calculates a fair-share split across all group members. It's a running tab, not a one-time settlement — log receipts as they happen and the math stays current.</P>
          <H>Meal Credits</H>
          <P>Meal Credits let you assign value to cooking labor, not just grocery spending. If one member cooks for the group three times this month and wants credit for that, a group admin can issue credits. Credits appear in the Equalizer's balance calculation alongside cash receipts.</P>
          <H>Send Digest</H>
          <P>The "Send Digest" button in the Corner header fires off a summary email to every group member. It covers inventory added, items expiring soon, upcoming bulk buy runs, the next swap schedule, and recent garden harvests. A cron job also auto-sends this every Sunday morning — the button is there for on-demand sends outside the weekly schedule.</P>
        </Section>

        <Section id="kuzine" icon={Package} title={`${name}'s Cuisine — Inventory, Shopping & Bulk Buys`}>
          <P>{name}'s Cuisine is your shared pantry and freezer manager. It has four tabs: Inventory, Vacuum Seal Log, Shopping Lists, and Bulk Buy Runs.</P>
          <H>Inventory</H>
          <P>Add any food item your group has on hand — name, quantity, category (protein, produce, pantry, etc.), and storage type (fresh, vacuum sealed, frozen, etc.). The app automatically calculates a use-by date based on storage type: fresh items get 5 days, vacuum sealed get 14, frozen get 90, and so on. To find a product quickly, use the search bar — it checks your local catalog first and falls back to the Open Food Facts database if there's no local match. You can also scan a barcode with your device camera to look up store-bought items instantly.</P>
          <H>Vacuum Seal Log</H>
          <P>Track everything that goes through the vacuum sealer — item name, seal date, expiry, storage location, and notes. Helpful for keeping the chest freezer organized when everything looks identical in its bag.</P>
          <H>Shopping Lists</H>
          <P>Create named shopping lists (e.g. "Weekly Whole Foods," "Sam's Club April Run") and add items manually or import a full recipe's ingredient list from Kitchen. Items linked to catalog products are automatically grouped by store section so the list flows aisle by aisle. Check items off as you shop — checked items sink to the bottom. Use "Clear Checked" to remove them when you're done.</P>
          <H>Bulk Buy Runs</H>
          <P>Planning a warehouse run? Create a Bulk Buy Run, set the date and who's doing the shopping, then have group members add the items they want. Once shopping is done, the settlement view calculates exactly what each person owes the buyer based on their items. Settle up directly in the app.</P>
          <Tip>Harvest something in your Garden? If you tick "Add to inventory" at log time, it auto-creates an entry here — no manual entry needed.</Tip>
        </Section>

        <Section id="kultivate" icon={Leaf} title={`${name}'s Garden — Plants & Harvest Tracking`}>
          <P>{name}'s Garden is your group's garden notebook. It has four tabs: Garden, Harvest Log, Calendar, and Growing Guides.</P>
          <H>Garden tab — tracking plants</H>
          <P>Add each plant with its name, planting date, expected harvest date, and current status (growing, flowering, harvesting, harvested, or dormant). When you type a plant name, the Hub searches the built-in growing guides and suggests matches — selecting one links the guide to your plant so you can pull up care details at any time with the book icon on the plant card.</P>
          <H>Harvest Log</H>
          <P>When you pull something from the ground, log it: plant name, harvest date, and yield amount. Tick "Auto-add to Cuisine inventory" and it'll create an inventory entry in your Cuisine with the storage type you choose — no separate step needed. Every harvest logged sends a notification to all group members.</P>
          <H>Seasonal Calendar</H>
          <P>The Calendar tab shows your plants organized by expected harvest month. It's a long-form planning view — great for mapping out the whole growing season and spotting when things will overlap.</P>
          <H>Growing Guides tab</H>
          <P>A library of 20+ plant guides covering vegetables, herbs, fruits, and flowers. Use the search bar to find any plant by name, or filter by type using the category buttons. Click any card to open the detail modal, which shows days to harvest, germination time, space requirements, USDA hardiness zones, sunlight and water needs, companion planting recommendations (and what to avoid planting nearby), growing tips, and external resource links to trusted gardening sites.</P>
          <Tip>When adding a plant, type its name in the "Plant name" field — if there's a matching guide it will appear in the dropdown. Linking a guide means you always have care info one click away from your garden card.</Tip>
        </Section>

        <Section id="equipment" icon={Wrench} title="Equipment — Catalog & Group Gear">
          <P>Equipment keeps track of two things: the recommended gear catalog and your group's actual inventory of who owns what.</P>
          <H>Equipment Catalog</H>
          <P>The catalog is pre-seeded with recommended hardware (vacuum sealers, chest freezers, label printers, scales), storage containers (Pyrex sets, mason jars, OXO pop containers), and expendables (vacuum bags, parchment paper, labels, markers). Recommended items are starred. Browse, filter by category, and follow purchase links to see the exact models the Hub is built around.</P>
          <H>My Group's Gear</H>
          <P>Members can log which catalog items they own — how many, whose they are, what condition they're in (new, good, fair, needs replacement), and any notes. This way the whole group can see who has the FoodSaver without having to ask, and you can spot gaps in the group's collective setup.</P>
          <H>Standard Supplies</H>
          <P>The Standard Supplies tab shows the group's agreed-upon container and consumable standards — the stuff everyone should be buying the same version of so lids are interchangeable and vacuum bags stack the same way. Think of it as a shared shopping standard rather than a tracked inventory.</P>
        </Section>

        <Section id="meal-swap" icon={ArrowLeftRight} title="Entrée Swap — Weekly Cooking Schedule">
          <P>The Entrée Swap page coordinates your group's weekly cooking rotation. The idea: each member makes one entrée per week to share with the group, and on Swap Day everyone exchanges what they made. One cook per week, group eats all week.</P>
          <H>How a swap week works</H>
          <P>A group admin creates a new swap week and sets the Swap Day — the date when entrées are exchanged. Each member is then assigned an entrée for that week. Members prep their assigned entrée at home and update their status as they go.</P>
          <H>Status flow</H>
          <P>Each assignment moves through four states: Assigned (you've been given an entrée to make), In Progress (you've started cooking), Ready (your entrée is packaged and ready for the exchange), and Swapped (the exchange is done). Update your own status directly from your swap card — only you can update yours, admins can update anyone's.</P>
          <H>Updating your status</H>
          <P>Click your swap card and use the status dropdown to move it forward. You don't need admin rights to update your own assignment — just don't touch anyone else's until Swap Day.</P>
          <H>Admin: creating a swap week</H>
          <P>From the Entrée Swap page, hit "New Swap Week," set the date range and Swap Day, then assign an entrée to each member. You can link a Kitchen recipe when assigning — it auto-fills the entrée name and lets everyone tap through to see the instructions.</P>
          <H>Swap history</H>
          <P>Past swap weeks stay visible in the history view below the current week. You can browse back to see who made what and when.</P>
          <Tip>Link a recipe when creating a swap assignment — that way everyone can tap the entrée name to see the full instructions without having to track you down.</Tip>
        </Section>

        <Section id="calendar" icon={Calendar} title="Group Calendar — What Every Color Means">
          <P>The Group Calendar gives a bird's-eye view of everything time-sensitive across the group. Click any day to see a detail panel of what's happening.</P>
          <H>Color codes</H>
          <P>Each event type has its own color so you can read the calendar at a glance. Green events are newly created inventory items. Yellow events are items expiring soon (within the warning window). Red events are expired items that need attention. Terracotta events are scheduled Bulk Buy runs. Moss/dark-green events are logged garden harvests.</P>
          <H>Expiry logic</H>
          <P>Inventory use-by dates are calculated automatically when you add an item — fresh items get 5 days, vacuum sealed get 14, frozen get 90. Those dates surface on the calendar as green dots when created, shift to yellow as they approach expiry, and turn red once they've passed. You don't need to enter dates manually.</P>
          <H>Clicking a day</H>
          <P>Click any day that has dots to open a detail panel listing every event on that date — item names, types, and quick links to the relevant page. It's the fastest way to see what needs to be used up on a specific day.</P>
          <Tip>The calendar updates live — add an inventory item and its expiry appears on the calendar immediately. No manual sync required.</Tip>
        </Section>

        <Section id="gallery" icon={Camera} title="Entrée Gallery — Your Visual Cookbook">
          <P>The Entrée Gallery is a shared photo feed for the group — every food photo from across the Hub in one place.</P>
          <H>Uploading photos</H>
          <P>Hit the Upload button on the Gallery page to add a photo directly. You can also add photos from inside a Kitchen recipe or tag a photo to an inventory item in Cuisine — either way it ends up in the Gallery. Add a caption when uploading to give the photo context.</P>
          <H>Three stages</H>
          <P>Every photo is tagged with a stage: Plated (the finished dish on a plate or in a bowl), Stored (portioned and labeled, ready for the freezer or fridge), or Prep (mid-cook process shots). Filter the gallery by stage to find exactly what you're looking for.</P>
          <H>Links back to recipes and inventory</H>
          <P>If a photo was uploaded from a recipe or linked to an inventory item, the gallery card shows a link — tap it to jump straight to that recipe in Kitchen or that item in Cuisine. Makes it easy to trace a plated photo back to the recipe that produced it.</P>
          <Tip>Filtering by "Stored" stage is handy before a bulk buy run — you can quickly see what's already in the freezer before deciding what entrées to add.</Tip>
        </Section>

        <Section id="product-catalog" icon={Search} title="Product Catalog — Search & Barcode Lookup">
          <P>The Product Catalog is the shared database of food products your group uses. It powers the inventory search, shopping list categorization, and barcode lookup across the app.</P>
          <H>How search works</H>
          <P>When you type a product name in Cuisine's inventory or shopping list, the Hub searches your local catalog first — products your group has added previously. If nothing matches locally, it falls back to the Open Food Facts database, which covers millions of barcoded grocery products. Results from Open Food Facts can be saved to your local catalog with one click.</P>
          <H>Barcode lookup</H>
          <P>In the Cuisine inventory tab, tap the barcode icon to activate your device camera. Point it at any product's barcode — if it's in Open Food Facts, the product name and category fill in automatically. This is the fastest way to log store-bought pantry items.</P>
          <H>Adding custom products</H>
          <P>For items that aren't in any external database (homemade sauces, bulk items, farmers market finds), you can create a custom product entry. Fill in the name, category, and optional notes, and optionally upload a photo so it's easy to identify in a list later. Custom products live in your group's local catalog and are available to all members.</P>
        </Section>

        <Section id="notifications" icon={Bell} title="Notifications — What Triggers Them">
          <P>The bell icon in the top-right header is your notification center. A red badge shows the count of unread notifications.</P>
          <H>What triggers a notification</H>
          <P>You'll get a notification when: a group member adds a new entrée or inventory item, an inventory item is nearing its expiry date, a bulk buy run is created or updated, a harvest is logged, someone invites you to a group, or an entrée swap week is created or you're assigned an entrée. The Hub will add more notification types as new features land.</P>
          <H>Reading notifications</H>
          <P>Click the bell to open the dropdown. Unread notifications have a subtle green highlight and a green dot. Click any notification to mark it read and navigate to the relevant page. Click "Mark all read" at the top to clear everything at once.</P>
          <H>Auto-refresh</H>
          <P>The notification count refreshes automatically every 60 seconds, so you'll see new activity without reloading the page.</P>
        </Section>

        <Section id="digest" icon={Mail} title="Weekly Digest — Emailing the Group">
          <P>The Weekly Digest is a branded HTML email that summarizes the past week's activity and previews what's coming up. It goes out to every member of your group.</P>
          <H>What's included</H>
          <P>The digest covers: entrées and inventory added in the past 7 days, items expiring in the next 7 days, upcoming bulk buy runs, the swap schedule for next week, and harvests logged this week. It's styled with the Hub's earthy color palette so it looks good in any email client.</P>
          <H>Sending it</H>
          <P>Hit the "Send Digest" button at the top of the Corner page. You'll be asked to confirm, then the email goes out to all group members simultaneously. A status message tells you how many were sent successfully.</P>
          <H>Previewing it</H>
          <P>Want to see what the email looks like before sending? Navigate to /api/digest/preview?group_id=YOUR_ID in a browser. It renders the full HTML in the browser window — no email sent.</P>
          <H>Auto-send</H>
          <P>The server runs a cron job every Sunday at 8am that auto-sends the digest to all groups with active members. The manual button is there for on-demand sends outside the weekly schedule.</P>
          <H>Email setup</H>
          <P>Email sending requires EMAIL_USER and EMAIL_PASS to be set in the server's .env file. If they're missing, the send button returns an error rather than failing silently — so if you hit an error, check with whoever set up the server.</P>
        </Section>

        <Section id="labels" icon={Tag} title="Label Generator — QR Codes & Printing">
          <P>The Label Generator creates printable labels for your vacuum-sealed bags, mason jars, and containers — complete with a QR code that links directly to the matching inventory item or vacuum seal log entry.</P>
          <H>How to use it</H>
          <P>Select the item you want to label from the dropdown (pulls from your inventory or vacuum seal log), customize the label fields (name, date, storage notes), and click Generate. A preview renders on screen — print directly from the browser or download as an image.</P>
          <H>QR codes</H>
          <P>Each label includes a unique QR code. Scanning it with any phone camera opens the item's detail page in the Hub, so you can see the full record — quantity, use-by date, which recipe it came from — without opening a computer.</P>
          <H>Printing tips</H>
          <P>For containers, use Avery 2" × 2" removable square labels — they peel cleanly off glass and plastic without residue. For vacuum bags, print labels on parchment paper cut to size and tuck them inside the bag before sealing — the label stays perfectly legible even in the freezer and there's no adhesive to deal with. Set print margins to zero and print at 100% scale (not "fit to page") for accurate sizing.</P>
        </Section>

        <Section id="profile" icon={User} title="Profile & Account">
          <P>Your profile page is where you personalize your account and control how you appear to group members.</P>
          <H>Avatar photo</H>
          <P>Click the circle at the top of your profile page (or the camera icon that appears on hover) to upload a profile photo. Supported formats are JPG, PNG, and GIF — max 5 MB. Once uploaded, your photo replaces the initials circle everywhere in the app: the sidebar, group member cards, the notification panel, and photo feed entries.</P>
          <H>Display name</H>
          <P>Your display name appears throughout the app — in recipe credits, the sidebar header, and anywhere your name shows. Update it anytime from your profile page.</P>
          <H>Social links</H>
          <P>Add your social media handles or URLs and they'll appear as clickable icons on your group member card. Supported platforms: website/blog, Instagram, TikTok, YouTube, Facebook, Twitter/X, and Pinterest.</P>
          <H>Signing out</H>
          <P>Hit the "Sign Out" button at the bottom of your profile page (or in the sidebar menu). You'll be returned to the login screen. Your data stays intact — everything is stored server-side and will be there when you log back in.</P>
        </Section>

        <Section id="tips" icon={Lightbulb} title="Power-User Tips">
          <P>A few things that make the Hub click once you've been using it for a while.</P>
          <H>Link recipes everywhere you can</H>
          <P>When creating a swap entrée assignment, link the Kitchen recipe. When logging a harvest, check "Add to inventory." When adding items to a shopping list, pull from a recipe. The Hub is built around these connections — the more you link, the more useful it gets.</P>
          <H>Use the barcode scanner in Cuisine</H>
          <P>For store-bought items, scanning the barcode is faster than typing. The product name and category fill in automatically from Open Food Facts. This is especially handy when logging a big Costco or Sam's Club haul after a bulk buy run.</P>
          <H>Send a digest before a swap week, not just after</H>
          <P>The manual Send Digest button in Corner isn't just for end-of-week summaries — fire it off on Thursday or Friday so everyone knows what's expiring and can factor that into what they cook for the swap.</P>
          <H>Parchment paper labels beat adhesive labels for frozen bags</H>
          <P>Print your Label Generator outputs on parchment paper, cut them to size, and tuck them inside the vacuum bag before sealing. They stay legible at -20°F, never fall off, and are trivial to remove when the bag's empty.</P>
          <H>Growing Guides before you plant</H>
          <P>Before adding a new plant in your Garden, browse the Growing Guides tab first. The companion planting info in the guide modal can save you from putting incompatible plants next to each other — something that's easy to overlook until it's too late in the season.</P>
          <H>Keep the calendar visible during planning</H>
          <P>The Group Calendar pulls from every module — inventory expiry, harvests, bulk buy runs. Open it on a second screen or a tablet when you're planning an entrée swap week or a warehouse run so you can see what's coming due without switching tabs.</P>
        </Section>

      </div>

      <div className="text-center py-10 text-slate-400 text-sm">
        <HelpCircle size={20} className="mx-auto mb-2 opacity-40" />
        <p>Have a question that's not covered here? Drop a note in your group chat and we'll add it.</p>
      </div>
    </div>
  )
}
