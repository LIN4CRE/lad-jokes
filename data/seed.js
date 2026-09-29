/* ═══════════════════════════════════════════════════════════════════════
   data/seed.js — demo corpus. Every handle, story and stat here is
   invented for a prototype. Raunchy by design; nobody real gets named,
   and nothing that happened to someone who didn't agree gets posted.
   Module: LJ.seed  (call LJ.seed.run() once, on first launch)
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util;
  var DAY = 86400000, HOUR = 3600000, MIN = 60000;

  var CATS = [
    { id: 'confessions', label: 'Confessions', icon: 'ghost', blurb: 'The things you do at 2am' },
    { id: 'pub', label: 'Pub Legend', icon: 'flame', blurb: 'Round one, no survivors' },
    { id: 'banter', label: 'Banter', icon: 'chat', blurb: 'Whose name is on the group chat' },
    { id: 'saggy', label: 'Saggy Stories', icon: 'heart', blurb: 'The night, in glorious decline' },
    { id: 'gymfail', label: 'Gym Fail', icon: 'zap', blurb: 'Ego writes cheques' },
    { id: 'stag', label: 'Stag & Hen', icon: 'users', blurb: 'Someone always texts a photo' },
    { id: 'work', label: 'Work', icon: 'db', blurb: 'Wrong chat, wrong time' },
    { id: 'travel', label: 'Travel', icon: 'cloud', blurb: 'Costa, then consequences' }
  ];

  var USERS = [
    { id: 'u_kev', handle: 'kevsaggy', name: 'Kev', flair: 'Certified Disappointment', bio: 'Writing it down so my mates stop saying I made it up.', joined: U.now() - 700 * DAY },
    { id: 'u_donut', handle: 'donutman99', name: 'Donut', flair: 'Round 14 Champion', bio: 'I buy the first round. That is my entire personality.', joined: U.now() - 540 * DAY },
    { id: 'u_gaz', handle: 'gazza_t', name: 'Gaz', flair: 'Ego Merchant', bio: 'Gym by 6am, mistakes by 6am and 4 minutes.', joined: U.now() - 400 * DAY },
    { id: 'u_bazza', handle: 'bazza', name: 'Bazza', flair: 'Stag Do War Criminal', bio: 'Ask me about the jet ski. Ask me not to.', joined: U.now() - 380 * DAY },
    { id: 'u_bren', handle: 'bren_from_work', name: 'Bren', flair: 'Wrong Chat Veteran', bio: 'Sent a meme to the all-staff list. Twice.', joined: U.now() - 260 * DAY },
    { id: 'u_paulo', handle: 'paulo_says_no', name: 'Paulo', flair: 'Voice Note Legend', bio: 'I record everything. This is how we know.', joined: U.now() - 150 * DAY },
    { id: 'u_taz', handle: 'taz', name: 'Taz', flair: 'Moderator', bio: 'I remove the ones that stop being funny. That is the whole job.', joined: U.now() - 900 * DAY, admin: true }
  ];

  function post(o) {
    return Object.assign({
      type: 'story', status: 'open', flags: [], views: 0,
      createdAt: U.now() - DAY, ratings: {}, myVote: 0
    }, o);
  }

  var POSTS = [
    post({
      id: 's1', type: 'story', title: 'My first "romantic" dinner ended with the fire alarm and a naked neighbour',
      body: 'Booked the table, lit the candles, felt like a man with a plan. Eight minutes in, the smoke alarm starts screaming. I do what any confident idiot does: I fan it with a tea towel while dinner burns.\n\nThe sprinklers did not join in. The neighbour did. He came out on the balcony to complain, realised he had forgotten his towel, and made a run for it past my open front door.\n\nShe asked if I always cooked with an audience. I said it was a tasting menu. We have been together three years and she still brings it up on my birthday, in front of my mum, with a big smile.',
      category: 'confessions', tags: ['cooking', 'neighbours', 'fire'], authorId: 'u_kev', author: 'kevsaggy', authorName: 'Kev',
      createdAt: U.now() - 4.2 * DAY, votes: 1247, views: 21400, comments: 6, featured: true, nsfw: true,
      ratings: ratingSpread(9.1, 214), flags: [{ why: 'Too honest, allegedly', by: 'anon_33', at: U.now() - 3 * DAY }]
    }),
    post({
      id: 's2', title: 'Ordered 11 curry sauces to "build my own", learned about regret in layers',
      body: 'The shop had the whole range so I did what a man with a spreadsheet would do: I bought the entire ladder, labelled them, made a scoring grid, invited the lads.\n\nBy sauce nine I was seeing God through my own ears. Someone moved the milk to the top shelf. There was no milk. There has never been milk. Gaz cried in a taxi and it was a two-minute journey.\n\nThe grid still exists. It is just a list of mistakes with a heading.',
      category: 'confessions', tags: ['curry', 'spice', 'lads'], authorId: 'u_donut', author: 'donutman99', authorName: 'Donut',
      createdAt: U.now() - 2.1 * DAY, votes: 903, views: 15100, comments: 5, nsfw: false,
      ratings: ratingSpread(8.4, 151)
    }),
    post({
      id: 's3', type: 'question', title: 'Wrong chat: I sent the "saggy saggy" meme to the client thread. Thoughts?',
      body: 'Two chats open. Same profile photo on both because I am an idiot. Client thread: 41 people, three of them directors. I have now read the whole thing back and it gets worse every pass.\n\nThe reply from the client was one word: "haha". Haha. One word, no exclamation. Do I resign, emigrate, or double down at the quarterly review? Be honest. I have already started looking at flats in Portugal.',
      category: 'work', tags: ['slack', 'career', 'portugal'], authorId: 'u_bren', author: 'bren_from_work', authorName: 'Bren',
      createdAt: U.now() - 0.6 * DAY, votes: 512, views: 9800, comments: 4,
      ratings: ratingSpread(7.2, 96)
    }),
    post({
      id: 's4', title: 'The sauna at my gym is a support group nobody asked for',
      body: 'Every Tuesday, three blokes, 84 degrees, no conversation of any value whatsoever. Someone always tells the same story about a jet ski. Someone always says "we\'re all straight here" as we leave.\n\nI have never once been able to walk properly afterwards. I have never once not gone back on Tuesday. We are all balding, everyone is hiding something behind a towel, and one guy brings a flask of tea in a sandwich bag.',
      category: 'gymfail', tags: ['sauna', 'lads', 'flask'], authorId: 'u_gaz', author: 'gazza_t', authorName: 'Gaz',
      createdAt: U.now() - 6.5 * DAY, votes: 728, views: 12300, comments: 4,
      ratings: ratingSpread(8.9, 178)
    }),
    post({
      id: 's5', type: 'poll', title: 'POLL: What actually happened on Gaz\'s stag do? Vote, then argue.',
      body: 'Bazza has given us four versions of this story and every one of them is worse than the last. The group chat has split into two camps. I am putting it to the people.',
      category: 'stag', tags: ['stag', 'dispute', 'voting'], authorId: 'u_paulo', author: 'paulo_says_no', authorName: 'Paulo',
      createdAt: U.now() - 1.4 * DAY, votes: 1102, views: 19400, comments: 5, pollId: 'p4',
      ratings: ratingSpread(8.6, 140)
    }),
    post({
      id: 's6', title: 'My mate\'s stag do at a "boutique wellness retreat" was the longest night of my life',
      body: 'The booking said "wild and wellness". Nobody briefed us on the wild part. There were sound bowls, a breath workshop, and 14 blokes in matching beige robes trying not to ask where the bar was.\n\nWe found it. It was a fridge. There was one warm cider per person and it was the groom\'s. By 11pm we had invented a game with a towel and a shoe that I cannot legally describe, and by 1am the receptionist was on the phone to someone in authority.\n\nStill the best night I have had in years. Still cannot look the groom in the eye.',
      category: 'stag', tags: ['stag', 'hotel', 'beige'], authorId: 'u_bazza', author: 'bazza', authorName: 'Bazza',
      createdAt: U.now() - 3.4 * DAY, votes: 654, views: 11000, comments: 3, nsfw: true,
      ratings: ratingSpread(8.1, 112)
    }),
    post({
      id: 's7', type: 'story', title: 'She asked "do you snore?" and I said "only in mono"',
      body: 'Genuine opener from a genuinely lovely woman, three dates in. I answered like a man trying to win. She said "cool" and moved the pillow to the other side of the bed.\n\nI have now bought a mouth strap, a fan, a white noise machine, and an app that records me. Turns out it is not mono. It is a whole orchestra. There is a part where I sound like a lawnmower clearing a hedge. I have listened to it 40 times. I do not know why.',
      category: 'banter', tags: ['dating', 'snoring', 'apps'], authorId: 'u_kev', author: 'kevsaggy', authorName: 'Kev',
      createdAt: U.now() - 1.9 * DAY, votes: 811, views: 13900, comments: 4,
      ratings: ratingSpread(7.7, 130)
    }),
    post({
      id: 's8', title: 'I called my girlfriend "mum" and my body has not forgiven me',
      body: 'The kind of story every bloke swears will never happen to him. It happened to me in the third week of living together. There was no audience, which is somehow the worst part. She just said "thanks, son" and went back to peeling a satsuma.\n\nI have started leaving notes around the flat saying "I am your partner". Nobody has asked for them. I am leaving them anyway.',
      category: 'confessions', tags: ['partners', 'word-vomit'], authorId: 'u_paulo', author: 'paulo_says_no', authorName: 'Paulo',
      createdAt: U.now() - 5.1 * DAY, votes: 430, views: 8100, comments: 2,
      ratings: ratingSpread(6.4, 88)
    }),
    post({
      id: 's9', title: 'A 5k "fun run" where the costume was the mistake',
      body: 'I thought an inflatable T-rex suit would get me a girlfriend. It got me a marshal with a clipboard and a very direct conversation about liability.\n\nThe arms do not work. You cannot wipe your own face. By mile three I was a sauna with a costume zip, and I could hear children screaming at me because, correctly, I am a dinosaur.\n\nMy shorts chose that moment to become a public document. I have since learned that a 5k is a very long time to be famous in a paddling pool.',
      category: 'gymfail', tags: ['5k', 'costume', 'shorts'], authorId: 'u_gaz', author: 'gazza_t', authorName: 'Gaz',
      createdAt: U.now() - 2.8 * DAY, votes: 985, views: 16800, comments: 5, nsfw: true,
      ratings: ratingSpread(9.4, 231)
    }),
    post({
      id: 's10', title: 'The hen do I got stuck behind and now know too much about',
      body: 'Poolside. Twelve of them. One matching sash, eleven opinions. I got wedged between a sun lounger and a cabana for forty minutes while a woman in a tiara explained her partner to a stranger in forensic detail.\n\nI have never stayed so still in my life. I have never heard the phrase "his cousin\'s mate" so many times in a row.\n\nI still see them at the same hotel every August. They wave. I wave back like a man with a secret, because I have nine of them and I will take none to my grave.',
      category: 'travel', tags: ['hotel', 'pool', 'sash'], authorId: 'u_donut', author: 'donutman99', authorName: 'Donut',
      createdAt: U.now() - 7.7 * DAY, votes: 622, views: 10400, comments: 3,
      ratings: ratingSpread(8.2, 121)
    }),
    post({
      id: 's11', title: 'Pub quiz legend: I invented a band, we won a crate, I nearly went to prison',
      body: 'They asked for the fourth member of a famous group. I panicked and named a man I invented. He had a job in Warrington. I was sure nobody would check. Nobody checked, we got the crate, and I felt like a genius for six days.\n\nThen a lad from the other team found him. Turns out he does exist, he does not like being in a band, and he wanted a word.\n\nHe came to the pub. We bought him a pint. He now comes every Thursday and he is the reason we still lose.',
      category: 'pub', tags: ['quiz', 'crate', 'warrington'], authorId: 'u_bazza', author: 'bazza', authorName: 'Bazza',
      createdAt: U.now() - 9.3 * DAY, votes: 1580, views: 27300, comments: 6, featured: true, nsfw: true,
      ratings: ratingSpread(9.6, 302)
    })
  ];

  function ratingSpread(mean, n) {
    var r = {}, rnd = U.prng(U.seedFrom('rt' + mean + n)), id = 1;
    for (var i = 0; i < Math.min(n, 46); i++) {
      var v = U.clamp(Math.round(mean * 2 + (rnd() - 0.5) * 6) / 2, 1, 10);
      r['anon' + (id++)] = v;
    }
    return r;
  }

  var POLLS = [
    {
      id: 'p1', question: 'What is genuinely in the gym bag that has been in the boot since spring?',
      context: 'Answer honestly. Nobody is checking. Except your partner, who has been checking for years.',
      author: 'gazza_t', createdAt: U.now() - 1.1 * DAY, closesAt: U.now() + 6 * DAY, anonymous: true,
      options: [
        { id: 'o1', label: 'A shoe with something in it', votes: 412 },
        { id: 'o2', label: 'A protein bar of geological interest', votes: 356 },
        { id: 'o3', label: 'Socks that have become a single sock', votes: 501 },
        { id: 'o4', label: 'A water bottle with its own weather', votes: 623 },
        { id: 'o5', label: 'Nothing. I am a clean machine. Liar.', votes: 189 }
      ]
    },
    {
      id: 'p2', question: 'Pick the real dating red flag',
      context: 'Submitted by bazza after "the bin incident".',
      author: 'bazza', createdAt: U.now() - 2.6 * DAY, closesAt: U.now() + 2 * DAY, anonymous: true,
      options: [
        { id: 'o1', label: 'Rude to waiters', votes: 903 },
        { id: 'o2', label: 'Still "friends" with every ex', votes: 761 },
        { id: 'o3', label: 'Rude to his own nan', votes: 1204 },
        { id: 'o4', label: 'Bin bag drag at 8am on a Saturday', votes: 388 },
        { id: 'o5', label: 'Owns a jet ski he describes as "temporary"', votes: 455 }
      ]
    },
    {
      id: 'p3', question: 'You are at minute 4 of a walk of shame past your own gym. Do you go in?',
      context: 'Time of day is part of the decision, we all know it.',
      author: 'kevsaggy', createdAt: U.now() - 0.4 * DAY, closesAt: U.now() + 9 * DAY, anonymous: true,
      options: [
        { id: 'o1', label: 'In. Sunglasses on, head down, straight to rowing.', votes: 812 },
        { id: 'o2', label: 'In, but only if the car park is half empty', votes: 654 },
        { id: 'o3', label: 'No. I live in the car park now.', votes: 402 },
        { id: 'o4', label: 'No. I have cancelled my membership by 11am', votes: 1103 }
      ]
    },
    {
      id: 'p4', question: 'So. Gaz\'s stag do. What actually happened? (jury is open)',
      context: 'Four versions circulating. One involves a jet ski. Vote your truth, Bazza.',
      author: 'paulo_says_no', createdAt: U.now() - 1.4 * DAY, closesAt: U.now() + 4 * DAY, anonymous: true,
      options: [
        { id: 'o1', label: 'Jet ski, no life jacket, wrong lake', votes: 1420 },
        { id: 'o2', label: 'Jet ski, no life jacket, wrong COUNTRY', votes: 986 },
        { id: 'o3', label: 'It was a paddleboard and everyone is lying', votes: 512 },
        { id: 'o4', label: 'Nobody knows. The group chat has been deleted.', votes: 733 }
      ]
    },
    {
      id: 'p5', question: 'The group chat: who is the one that never replies but always shows up?',
      context: 'Tag them. They will hate it. That is the point.',
      author: 'donutman99', createdAt: U.now() - 5.9 * DAY, closesAt: U.now() + 1 * DAY, anonymous: false,
      options: [
        { id: 'o1', label: 'Read 471, replied 3', votes: 1320 },
        { id: 'o2', label: 'Sends one voice note a month, 9 minutes long', votes: 1512 },
        { id: 'o3', label: 'Only replies in memes, never words', votes: 908 },
        { id: 'o4', label: 'Has left the chat twice, both times for a holiday', votes: 651 }
      ]
    }
  ];

  var COMMENTS = [
    { id: 'c1', postId: 's1', author: 'taz', authorId: 'u_taz', text: 'Approved on sight. The neighbour is the reason this site exists.', at: U.now() - 3.9 * DAY, votes: 84 },
    { id: 'c2', postId: 's1', author: 'anon_9f31', anon: true, text: 'You fanned it with a TEA TOWEL. That is the funniest sentence posted this month.', at: U.now() - 3.6 * DAY, votes: 61 },
    { id: 'c3', postId: 's1', author: 'gazza_t', authorId: 'u_gaz', text: 'Three years and she still tells it at your birthday in front of your mum? Marry her, you muppet.', at: U.now() - 3.1 * DAY, votes: 129 },
    { id: 'c4', postId: 's1', author: 'donutman99', authorId: 'u_donut', text: 'The sprinklers "did not join in" is doing so much work here.', at: U.now() - 2.4 * DAY, votes: 33 },
    { id: 'c5', postId: 's9', author: 'bazza', authorId: 'u_bazza', text: 'Mile three of an inflatable dinosaur run is a war crime you commit on yourself.', at: U.now() - 2.5 * DAY, votes: 96 },
    { id: 'c6', postId: 's9', author: 'anon_4a02', anon: true, text: 'My shorts did this at a parkrun in 2019. I moved towns. Worth it.', at: U.now() - 1.7 * DAY, votes: 142 },
    { id: 'c7', postId: 's11', author: 'paulo_says_no', authorId: 'u_paulo', text: 'The man from Warrington turning up every Thursday is the perfect ending.', at: U.now() - 8.4 * DAY, votes: 77 },
    { id: 'c8', postId: 's2', author: 'taz', authorId: 'u_taz', text: 'No milk. Never milk. This is the funniest structural failure in the archive.', at: U.now() - 1.8 * DAY, votes: 54 },
    { id: 'c9', postId: 's3', author: 'taz', authorId: 'u_taz', text: 'Not removing it. Consider this a public service.', at: U.now() - 0.4 * DAY, votes: 41 },
    { id: 'c10', postId: 's4', author: 'donutman99', authorId: 'u_donut', text: 'Tea in a sandwich bag is the most honest thing ever described on this site.', at: U.now() - 5.9 * DAY, votes: 88 }
  ];

  var THREADS = [
    {
      id: 't_pub', kind: 'room', title: 'Pub Banter', blurb: 'Open room, 4 online. Behave-ish.',
      members: ['kevsaggy', 'donutman99', 'gazza_t', 'bazza'],
      createdAt: U.now() - 40 * DAY,
      messages: [
        { id: 'm1', from: 'donutman99', at: U.now() - 26 * HOUR, text: 'who is buying the first round and who is pretending to look for their wallet' },
        { id: 'm2', from: 'gazza_t', at: U.now() - 25.4 * HOUR, text: 'I have been looking for it since 2019' },
        { id: 'm3', from: 'kevsaggy', at: U.now() - 3.2 * HOUR, text: 'right lads, poll is open. if I get nominated for the walk of shame award I am deleting the app again' },
        { id: 'm4', from: 'bazza', at: U.now() - 2.7 * HOUR, text: 'too late, we screenshotted. also the sauna story is mine and Gaz stole it' },
        { id: 'm5', from: 'gazza_t', at: U.now() - 2.1 * HOUR, text: 'the sauna belongs to nobody. the flask belongs to me.' }
      ]
    },
    {
      id: 't_ops', kind: 'team', title: 'Content Ops', blurb: 'Moderators only. Drafts, queues, escalations.',
      members: ['taz', 'kevsaggy'],
      createdAt: U.now() - 12 * DAY,
      messages: [
        { id: 'm6', from: 'taz', at: U.now() - 5.1 * HOUR, text: 's3 (wrong chat) is flagged twice but it is a question not an attack, keeping it' },
        { id: 'm7', from: 'kevsaggy', at: U.now() - 4.6 * HOUR, text: 'agree. the "haha" line is the reason it is at 500 upvotes' },
        { id: 'm8', from: 'taz', at: U.now() - 20 * MIN, text: 'weekly outrage report goes out 9am, I have pinned the top five by mean rating' }
      ]
    },
    {
      id: 't_dms', kind: 'dm', title: 'bazza ↔ you', blurb: 'Direct message. Encrypted at rest.',
      members: ['bazza', 'kevsaggy'],
      createdAt: U.now() - 6 * HOUR,
      messages: [
        { id: 'm9', from: 'bazza', at: U.now() - 55 * MIN, text: 'mate. the stag poll. 986 people think it was another country' },
        { id: 'm10', from: 'kevsaggy', at: U.now() - 44 * MIN, text: 'was it' },
        { id: 'm11', from: 'bazza', at: U.now() - 31 * MIN, text: 'the paddleboard is a red herring and you know it' }
      ]
    }
  ];

  var FILES = [
    { id: 'f1', name: 'saggy-saggy-final-v3.png', folder: 'assets', kind: 'image', size: 482113, updated: U.now() - 2 * DAY, owner: 'kevsaggy' },
    { id: 'f2', name: 'pub-quiz-flyer.pdf', folder: 'assets', kind: 'doc', size: 220145, updated: U.now() - 4 * DAY, owner: 'bazza' },
    { id: 'f3', name: 'outrage-report-w38.csv', folder: 'reports', kind: 'data', size: 84120, updated: U.now() - 9 * HOUR, owner: 'taz' },
    { id: 'f4', name: 'outrage-report-w37.csv', folder: 'reports', kind: 'data', size: 79002, updated: U.now() - 8 * DAY, owner: 'taz' },
    { id: 'f5', name: 'moderation-escalations.xlsx', folder: 'reports', kind: 'data', size: 131880, updated: U.now() - 30 * HOUR, owner: 'taz' },
    { id: 'f6', name: 'brand-guidelines.md', folder: 'shared', kind: 'doc', size: 14220, updated: U.now() - 12 * DAY, owner: 'taz' },
    { id: 'f7', name: 'legal-do-not-post.txt', folder: 'shared', kind: 'doc', size: 3110, updated: U.now() - 22 * DAY, owner: 'taz' },
    { id: 'f8', name: 'voice-note-paulo-9min.m4a', folder: 'archive', kind: 'audio', size: 8211004, updated: U.now() - 3 * DAY, owner: 'paulo_says_no' },
    { id: 'f9', name: 'walk-of-shame-award.mp4', folder: 'archive', kind: 'video', size: 41220011, updated: U.now() - 6 * DAY, owner: 'bazza' }
  ];

  var BOARD = [
    { id: 'b1', col: 'triage', title: 'Reels: "Story Time" auto-captions', who: 'taz', due: U.now() + 3 * DAY, tag: 'product', votes: 3 },
    { id: 'b2', col: 'triage', title: 'Rate-limit the "outrage" dial (vote flooding)', who: 'gazza_t', due: U.now() + 5 * DAY, tag: 'trust', votes: 7 },
    { id: 'b3', col: 'doing', title: 'Push notification copy: milestone alerts', who: 'kevsaggy', due: U.now() + 1 * DAY, tag: 'growth', votes: 11 },
    { id: 'b4', col: 'doing', title: 'Offline queue for drafts + poll votes', who: 'bazza', due: U.now() + 2 * DAY, tag: 'mobile', votes: 6 },
    { id: 'b5', col: 'review', title: 'Encrypted chat: key rotation on logout', who: 'donutman99', due: U.now() - 1 * DAY, tag: 'security', votes: 9 },
    { id: 'b6', col: 'review', title: 'Admin dashboard: drag-drop widgets', who: 'paulo_says_no', due: U.now() - 2 * DAY, tag: 'ops', votes: 4 },
    { id: 'b7', col: 'shipped', title: 'Anonymous ratings (device token, no handles)', who: 'taz', due: U.now() - 9 * DAY, tag: 'core', votes: 22 },
    { id: 'b8', col: 'shipped', title: 'Share sheet: X, FB, Reddit, WhatsApp, Telegram', who: 'bazza', due: U.now() - 14 * DAY, tag: 'growth', votes: 17 }
  ];

  var REPORTS = [
    { id: 'r1', name: 'Daily engagement digest', cadence: 'daily', at: '07:30', to: '#content-ops', lastRun: U.now() - 14 * HOUR, format: 'csv', on: true },
    { id: 'r2', name: 'Weekly outrage report (top 20 by mean rating)', cadence: 'weekly', at: 'Mon 09:00', to: 'leadership@ladjokes.example', lastRun: U.now() - 3 * DAY, format: 'pdf', on: true },
    { id: 'r3', name: 'Moderation & escalations', cadence: 'weekly', at: 'Fri 16:00', to: '#trust-safety', lastRun: U.now() - 5 * DAY, format: 'csv', on: false }
  ];

  var NOTIFS = [
    { id: 'n1', kind: 'milestone', title: 'Your story hit 1.2k upvotes', body: '"My first romantic dinner…" is in the top 3 of the week.', postId: 's1', at: U.now() - 40 * MIN, read: false },
    { id: 'n2', kind: 'message', title: 'New DM from bazza', body: '"the paddleboard is a red herring and you know it"', threadId: 't_dms', at: U.now() - 31 * MIN, read: false },
    { id: 'n3', kind: 'outrage', title: 'You rated this 9/10 and you were not alone', body: 'Mean outrage score is now 9.6 — the highest in Pub Legend.', postId: 's11', at: U.now() - 6 * HOUR, read: true }
  ];

  var WIDGETS = ['analytics', 'trending', 'moderation', 'sync', 'reports', 'files', 'board', 'presence'];

  LJ.seed = {
    CATS: CATS,
    run: function (force) {
      var S = LJ.store;
      S.ready();
      if (!force && (S.all('posts').length || S.all('users').length)) return false;

      S.set('users', USERS.map(function (u) { return Object.assign({}, u); }));
      S.set('posts', POSTS.map(function (p) {
        var out = Object.assign({}, p);
        out.outrage = meanRating(out.ratings);
        return out;
      }));
      S.set('comments', COMMENTS.slice());
      S.set('polls', POLLS.map(function (p) { return Object.assign({}, p, { myVote: null }); }));
      S.set('threads', THREADS.map(function (t) {
        return Object.assign({}, t, {
          messages: t.messages.map(function (m) {
            return { id: m.id, from: m.from, at: m.at, alg: 'xor-demo', env: LJ.crypto.encryptSync(m.text, 'lj-demo-thread-key', t.id), reactions: {} };
          })
        });
      }));
      S.set('files', FILES.slice());
      S.set('board', BOARD.slice());
      S.set('reports', REPORTS.slice());
      S.set('notes', NOTIFS.slice());
      S.set('widgetOrder', WIDGETS.slice());
      S.set('settings', {
        notifPush: false, notifMilestones: true, notifMessages: true, notifReplies: true,
        simEngagement: true, offline: true, autoReports: true, compactMod: false, anonRatingHandle: 'anon_' + U.hash('device' + U.now()).slice(0, 4)
      });
      S.set('meta', { seededAt: U.now(), build: 'lad-jokes-prototype-1', tab: U.uid('tab') });
      U.toast('Demo data loaded', POSTS.length + ' stories, ' + POLLS.length + ' polls, 3 threads, ' + FILES.length + ' files.', 'ok', 4200);
      return true;
    },
    meanRating: meanRating
  };

  function meanRating(ratings) {
    var v = Object.keys(ratings || {}).map(function (k) { return ratings[k]; });
    if (!v.length) return 0;
    return Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length * 100) / 100;
  }
  /* first launch only — idempotent, cheap, and wipe-recoverable via Settings */
  try { LJ.store.ready(); if (!LJ.store.all('posts').length) LJ.seed.run(); } catch (e) { console.warn('seed skipped', e); }
})();
