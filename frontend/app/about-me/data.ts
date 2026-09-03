import type { TimelineEntry } from './types';

/**
 * About Me timeline content.
 *
 * To add an item: append an object (unique `id`), drop an image in
 * `frontend/public/about-me/`, and point `image.src` at it.
 */
export const TIMELINE: TimelineEntry[] = [
  {
    id: 'helix-research',
    kind: 'work',
    year: '2016–2018',
    startYear: 2016,
    title: 'Research assistant, formulation informatics',
    org: 'Helix University',
    location: 'Cambridge, MA',
    summary: 'Built early models that mapped tablet process settings to dissolution.',
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed the lab ran wet-granulation campaigns while I cleaned process traces and trained compact regressors on compaction force, humidity, and blend time. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae.',
    highlights: [
      'Automated a 12-parameter batch log into a reusable modeling table',
      'First internal model beat a linear baseline on disintegration time',
      'Mentored two undergrads on design-of-experiments writeups',
    ],
    image: {
      src: '/about-me/campus.svg',
      alt: 'Stylized campus buildings and a quad',
    },
  },
  {
    id: 'dissolution-paper',
    kind: 'publication',
    year: '2019',
    startYear: 2019,
    title: 'Surrogate models for immediate-release dissolution',
    org: 'Journal of Applied Chemoinformatics',
    summary: 'A methods paper on cheap surrogates for tablet dissolution curves.',
    body: 'Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. We reported a two-stage workflow: a Gaussian process on the dissolution curve, then a random forest on the GP’s summary statistics. Integer ut orci vel magna dictum tincidunt. Placeholder abstract — swap this paragraph for the real one.',
    highlights: [
      'n = 86 lots, 4 process sites',
      'Open supplementary notebooks (link later)',
      'Cited internally as the “curve-then-forest” recipe',
    ],
    image: {
      src: '/about-me/journal.svg',
      alt: 'Stacked journal pages and a citation mark',
    },
  },
  {
    id: 'northwind-labs',
    kind: 'work',
    year: '2020–2023',
    startYear: 2020,
    title: 'ML scientist, materials & process',
    org: 'Northwind Labs',
    location: 'Boston, MA',
    summary: 'Production models for formulation screening and process deviation.',
    body: 'Aliquam erat volutpat. At Northwind I moved the university prototypes onto a shared feature store and stood up the first dashboard the process team actually used during campaigns. Donec sit amet sapien ut urna tristique aliquet. Lorem ipsum dolor sit amet, consectetur adipiscing elit — replace with the real team narrative.',
    highlights: [
      'Shipped three monitored models into the plant historian',
      'Cut candidate-screen turnaround from days to hours',
      'Paired weekly with formulation SMEs on feature definitions',
    ],
    image: {
      src: '/about-me/lab.svg',
      alt: 'Abstract laboratory bench with flasks and a monitor',
    },
  },
  {
    id: 'compaction-patent',
    kind: 'patent',
    year: '2021',
    startYear: 2021,
    title: 'Adaptive tablet compaction using in-line density estimates',
    org: 'USPTO · US 11,000,001 B2',
    summary: 'Closed-loop press control from a cheap density surrogate.',
    body: 'Nam libero tempore, cum soluta nobis est eligendi optio. The filing covers a control loop that nudges turret speed and fill depth from a running density estimate, rather than waiting for end-of-batch assay. Placeholder claims summary — drop in the real abstract and a figure later.',
    highlights: [
      'Co-inventor with process engineering',
      'Filed 2021 · granted (placeholder)',
      'Figure 2 is the control schematic (swap image)',
    ],
    image: {
      src: '/about-me/patent-tablet.svg',
      alt: 'Geometric tablet press and density traces',
    },
  },
  {
    id: 'shap-formulation',
    kind: 'publication',
    year: '2022',
    startYear: 2022,
    title: 'Reading SHAP waterfalls with formulation scientists',
    org: 'Molecular Informatics Letters',
    summary: 'A field note on explaining multivariate tablet models to SMEs.',
    body: 'Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis. The paper is less about a new estimator and more about a review ritual: waterfall plots beside the batch record, annotated live. Quis autem vel eum iure reprehenderit — filler until the real abstract lands.',
    highlights: [
      'Qualitative study with 9 scientists',
      'Template figure set reused in this dashboard',
      'Preprint link TBD',
    ],
    image: {
      src: '/about-me/waterfall.svg',
      alt: 'Abstract SHAP waterfall bars',
    },
  },
  {
    id: 'molecular-map-patent',
    kind: 'patent',
    year: '2023',
    startYear: 2023,
    title: 'Neighborhood maps for small-molecule design sets',
    org: 'USPTO · US 11,000,002 B2',
    summary: 'A layout method that keeps analog series readable on a 2D map.',
    body: 'At vero eos et accusamus et iusto odio dignissimos ducimus. The invention is a two-stage embedding: chemical similarity for local neighborhoods, then a weakly supervised pull that keeps analog series from smearing across the canvas. Placeholder — replace with the filed claims language you are comfortable publishing.',
    highlights: [
      'Covers the “molecular space map” interaction',
      'Works with fingerprint or learned embeddings',
      'Figure-heavy — good candidate for a real diagram later',
    ],
    image: {
      src: '/about-me/molecule.svg',
      alt: 'Abstract molecule graph on a dotted map',
    },
  },
  {
    id: 'staff-ml',
    kind: 'work',
    year: '2024–present',
    startYear: 2024,
    title: 'Staff ML engineer, modeling workbench',
    org: 'Independent / this dashboard',
    location: 'Remote',
    summary: 'The public workbench for model QA, SHAP, and molecular maps.',
    body: 'Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus. This stretch is the product layer on top of the science: violin plots, heatmaps, waterfalls, and the dataset generator in one place. Lorem ipsum dolor sit amet — swap for the current-role paragraph when you are ready.',
    highlights: [
      'Unified overview + interpretability surfaces',
      'Bonus tracks: molecular design, CV, synthetic data',
      'Still filling this one in',
    ],
    image: {
      src: '/about-me/dashboard.svg',
      alt: 'Abstract dashboard cards and a scatter plot',
    },
  },
];
