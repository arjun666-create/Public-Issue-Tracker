import type { CivicIssue, CivicSettings } from '../types/issue';

export const DEFAULT_SYSTEM_INSTRUCTION = `You are the Senior Municipal Triage Engineer for CivicResolve, an urban infrastructure triage platform.
Inspect citizen-reported civic complaints (text and optional field photograph) and return a strict structured JSON assessment for municipal dispatch.

Rules:
1. verified_category: Choose the single most accurate category from the allowed list. Override the citizen's selected category if the complaint text or photograph clearly belongs to a different category.
2. priority_level: Assign Low, Medium, High, or Critical based on immediate public safety hazards (live electrical wires, open manholes, deep craters near schools/hospitals, major flooding = Critical).
3. priority_reasoning: Write a concise 1-sentence justification explaining why this priority level was assigned.
4. recommended_department: Route to the most specific municipal department (e.g., Greater Chennai Corporation - Roads Dept, CMWSSB Metro Water, TANGEDCO Electrical, Solid Waste Management, Parks & Urban Forestry Dept).
5. ai_visual_verification: If a photograph is attached, verify whether the image matches the description and highlight visible hazards in 1-2 crisp sentences. If no image is attached, state exactly: "No image attached".
6. actionable_summary: Write a crisp 1-sentence dispatch directive for field crews.`;

export const DEFAULT_SETTINGS: CivicSettings = {
  triageMode: 'autonomous',
  sopRules: [
    {
      id: 'sop-roads',
      category: 'Roads & Potholes',
      keywords: 'pothole, crater, asphalt, road, pavement, sinkhole, speedbreaker, culvert',
      department: 'Greater Chennai Corporation - Roads Dept',
      sla: '4 Hours',
      defaultPriority: 'High',
      officerContact: 'Zone-08 Er. Karthik V. (+91 44-2538-4510)',
    },
    {
      id: 'sop-water',
      category: 'Water Supply & Drainage',
      keywords: 'water, leak, pipe, flood, flooding, drain, sewage, monsoon, manhole, stagnation',
      department: 'CMWSSB Metro Water',
      sla: '4 Hours',
      defaultPriority: 'Critical',
      officerContact: 'Area-13 Depot Eng. S. Priya (+91 44-2845-1300)',
    },
    {
      id: 'sop-electrical',
      category: 'Streetlights & Electrical',
      keywords: 'wire, cable, pole, transformer, spark, streetlight, dark, electric, shock',
      department: 'TANGEDCO Electrical',
      sla: '12 Hours',
      defaultPriority: 'Critical',
      officerContact: 'Adyar Circle AE R. Sundar (+91 44-2441-1912)',
    },
    {
      id: 'sop-waste',
      category: 'Sanitation & Waste',
      keywords: 'garbage, trash, bin, waste, dump, debris, compactor, odor, litter',
      department: 'Solid Waste Management',
      sla: '24 Hours',
      defaultPriority: 'Medium',
      officerContact: 'Zone-10 Sanitary Officer M. Devi (+91 44-2434-2105)',
    },
    {
      id: 'sop-parks',
      category: 'Parks & Public Spaces',
      keywords: 'park, bench, tree, branch, playground, walkway, fence, gate',
      department: 'Parks & Urban Forestry Dept',
      sla: '72 Hours',
      defaultPriority: 'Low',
      officerContact: 'Mylapore Div. Hort. Sup. K. Rajan (+91 44-2498-3320)',
    },
  ],
  aiConfig: {
    sensitivity: 'balanced',
    systemInstructionOverride: DEFAULT_SYSTEM_INSTRUCTION,
    languageTone: 'technical',
  },
};

export const MONSOON_SCENARIO_ISSUES: CivicIssue[] = [
  {
    id: 'CR-2026-2001',
    title: 'Knee-deep monsoon waterlogging submerging Velachery-Tambaram arterial road',
    description:
      'Continuous northeast monsoon downpour has blocked storm water inlets near Vijayanagar junction, submerging two lanes and stalling ambulances and MTC buses.',
    location: 'Vijayanagar Bus Terminus, Velachery Main Road, Chennai (12.9784° N, 80.2212° E)',
    userCategory: 'Water Supply & Drainage',
    photoUrl: '/src/assets/images/issue_water_velachery_1795237575595.jpg',
    status: 'Reported',
    createdAt: '2026-11-20T21:45:00.000Z',
    updatedAt: '2026-11-20T21:45:00.000Z',
    upvotes: 89,
    aiTriage: {
      verified_category: 'Water Supply & Drainage',
      priority_level: 'Critical',
      priority_reasoning:
        'Arterial floodwater submerging transit corridors blocks emergency vehicles and conceals open storm drains.',
      recommended_department: 'CMWSSB Metro Water',
      ai_visual_verification:
        'Visual inspection indicates heavy surface runoff overwhelming curbside storm grate capacity.',
      actionable_summary:
        'Deploy high-capacity mobile dewatering pump unit and jet-rodding crew to clear storm drain outfall immediately.',
      routing_source: 'gemini-ai',
    },
  },
  {
    id: 'CR-2026-2002',
    title: 'Snapped overhead feeder cable sparking near flooded Adyar bus shelter',
    description:
      'Gusty monsoon winds snapped an overhead LT service line onto a puddle outside the Adyar signal bus shelter, creating intermittent sparking.',
    location: 'Sardar Patel Road, Adyar Signal Bus Shelter, Chennai (13.0068° N, 80.2545° E)',
    userCategory: 'Streetlights & Electrical',
    photoUrl: '/src/assets/images/issue_streetlight_adyar_1795237575280.jpg',
    status: 'Reported',
    createdAt: '2026-11-20T21:52:00.000Z',
    updatedAt: '2026-11-20T21:52:00.000Z',
    upvotes: 112,
    aiTriage: {
      verified_category: 'Streetlights & Electrical',
      priority_level: 'Critical',
      priority_reasoning:
        'Energized electrical conductor contacting standing rainwater in a high-pedestrian transit zone poses lethal electrocution risk.',
      recommended_department: 'TANGEDCO Electrical',
      ai_visual_verification:
        'Photograph shows exposed streetlight feeder box and hanging conductors directly adjacent to wet pedestrian paving.',
      actionable_summary:
        'Trigger emergency feeder trip on Adyar SS-04, cordon 15m perimeter, and dispatch insulated boom-truck crew.',
      routing_source: 'gemini-ai',
    },
  },
  {
    id: 'CR-2026-2003',
    title: 'Collapsed monsoon road shoulder beside Anna Nagar school crossing',
    description:
      'Heavy rain runoff undermined the asphalt edge near 2nd Avenue school crossing, opening a 1.5-meter submerged crater.',
    location: '2nd Avenue Eastbound, Anna Nagar, Chennai (13.0850° N, 80.2101° E)',
    userCategory: 'Roads & Potholes',
    photoUrl: '/src/assets/images/issue_pothole_anna_nagar_1795237574227.jpg',
    status: 'In Progress',
    createdAt: '2026-11-20T21:30:00.000Z',
    updatedAt: '2026-11-20T22:05:00.000Z',
    upvotes: 57,
    officialNote:
      'Emergency Monsoon Task Force has placed reflective water-filled barricades; aggregate stabilization underway.',
    aiTriage: {
      verified_category: 'Roads & Potholes',
      priority_level: 'Critical',
      priority_reasoning:
        'Submerged asphalt failure along a school crossing corridor creates severe risk of vehicle axle collapse and pedestrian injury.',
      recommended_department: 'Greater Chennai Corporation - Roads Dept',
      ai_visual_verification:
        'Image confirms deep water-filled pavement collapse intersecting yellow pedestrian crossing bars.',
      actionable_summary:
        'Erect illuminated monsoon hazard barricades, dewater pit, and pack crushed WMM base before hot-patch sealing.',
      routing_source: 'gemini-ai',
    },
  },
];
