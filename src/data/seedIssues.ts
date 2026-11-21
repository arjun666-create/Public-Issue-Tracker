import type { CivicIssue } from '../types/issue';

export const SEED_ISSUES: CivicIssue[] = [
  {
    id: 'CR-2026-1041',
    title: 'Deep water-logged crater at SBOA School pedestrian crossing',
    description:
      'A wide, jagged pothole spanning nearly half the southbound lane has filled with muddy rainwater right on the yellow zebra crossing outside SBOA School. Two-wheelers and school vans are swerving abruptly to avoid it during morning drop-off.',
    location: '2nd Avenue, Near SBOA School, Anna Nagar West, Chennai (13.0878° N, 80.2004° E)',
    userCategory: 'Roads & Potholes',
    photoUrl: '/src/assets/images/issue_pothole_anna_nagar_1795237574227.jpg',
    status: 'Reported',
    createdAt: '2026-11-20T08:15:00.000Z',
    updatedAt: '2026-11-20T08:15:00.000Z',
    upvotes: 48,
    aiTriage: {
      verified_category: 'Roads & Potholes',
      priority_level: 'Critical',
      priority_reasoning:
        'Deep, water-obscured road crater located directly on an active school pedestrian crossing poses an immediate collision and fall hazard.',
      recommended_department: 'Storm Water Drain & Roads Dept',
      ai_visual_verification:
        'Photograph confirms a large, water-filled asphalt collapse intersecting yellow pedestrian crossing markings with active motorcycle and auto-rickshaw traffic nearby.',
      actionable_summary:
        'Deploy emergency road-patching crew with barricades, pump standing water, and apply cold-mix asphalt resurfacing before next school commute.',
    },
  },
  {
    id: 'CR-2026-1042',
    title: 'Exposed electrical junction box with hanging cables on streetlight pole',
    description:
      'The metal feeder door on streetlight pole #44 along LB Road has broken open, leaving tangled live cables hanging at pedestrian shoulder height right beside the bus stop walkway.',
    location: 'LB Road, Near Indira Nagar Signal, Adyar, Chennai (13.0012° N, 80.2565° E)',
    userCategory: 'Streetlights & Electrical',
    photoUrl: '/src/assets/images/issue_streetlight_adyar_1795237575280.jpg',
    status: 'In Progress',
    createdAt: '2026-11-19T17:40:00.000Z',
    updatedAt: '2026-11-20T06:30:00.000Z',
    upvotes: 64,
    officialNote:
      'TANGEDCO Zone-13 lineman team dispatched. Temporary circuit isolation completed; replacement weatherproof junction enclosure scheduled for installation today.',
    aiTriage: {
      verified_category: 'Streetlights & Electrical',
      priority_level: 'Critical',
      priority_reasoning:
        'Open high-voltage streetlight junction box with dangling exposed wires beside a busy pedestrian sidewalk creates a severe electrocution hazard.',
      recommended_department: 'TANGEDCO / Streetlight Maintenance',
      ai_visual_verification:
        'Image verifies a corroded municipal pole with an open metal distribution cabinet and loose insulated conductors dangling toward the pavement at dusk.',
      actionable_summary:
        'Immediately isolate power feed to pole #44, secure exposed conductors, and install a locked weather-sealed junction box.',
    },
  },
  {
    id: 'CR-2026-1043',
    title: 'Ruptured municipal water main valve flooding storm grate',
    description:
      'Continuous pressurized clean water has been gushing out of a damaged cast-iron street valve since 6 AM, wasting thousands of liters and pooling across the left turn lane.',
    location: '100 Feet Bypass Road Corner, Velachery, Chennai (12.9815° N, 80.2180° E)',
    userCategory: 'Water Supply & Drainage',
    photoUrl: '/src/assets/images/issue_water_velachery_1795237575595.jpg',
    status: 'In Progress',
    createdAt: '2026-11-20T06:05:00.000Z',
    updatedAt: '2026-11-20T09:10:00.000Z',
    upvotes: 31,
    officialNote:
      'Metro Water emergency valve crew has isolated the secondary branch line and is replacing the damaged flange gasket.',
    aiTriage: {
      verified_category: 'Water Supply & Drainage',
      priority_level: 'High',
      priority_reasoning:
        'Pressurized potable water main discharge causes heavy resource loss, weakens road sub-base, and creates hydroplaning risk for commuters.',
      recommended_department: 'Metro Water & Sewerage Board',
      ai_visual_verification:
        'Photo clearly shows a cast-iron municipal standpipe valve discharging a heavy stream of water directly into a rusted kerbside storm grate.',
      actionable_summary:
        'Shut upstream isolation gate, inspect flange bolts and seat ring on the street valve assembly, and replace ruptured seal.',
    },
  },
  {
    id: 'CR-2026-1044',
    title: 'Overflowing market compactor bin blocking Ranganathan St footpath',
    description:
      'Commercial refuse has spilled over the municipal green bin onto the pedestrian walkway and road edge, forcing shoppers onto the carriageway and causing foul odor.',
    location: 'Ranganathan Street Market Junction, T. Nagar, Chennai (13.0382° N, 80.2315° E)',
    userCategory: 'Sanitation & Waste',
    photoUrl: '/src/assets/images/issue_waste_t_nagar_1795237574826.jpg',
    status: 'Reported',
    createdAt: '2026-11-20T07:20:00.000Z',
    updatedAt: '2026-11-20T07:20:00.000Z',
    upvotes: 22,
    aiTriage: {
      verified_category: 'Sanitation & Waste',
      priority_level: 'Medium',
      priority_reasoning:
        'Overflowing commercial waste obstructs high-footfall market pedestrian access and poses local hygiene issues without immediate structural danger.',
      recommended_department: 'Solid Waste Management',
      ai_visual_verification:
        'Image confirms an overfilled green municipal wheeled dumpster with bagged plastic and organic market waste spilling across the concrete sidewalk.',
      actionable_summary:
        'Schedule immediate compactor truck clearance for Zone-10 T. Nagar beat and add a second midday collection cycle for market bins.',
    },
  },
  {
    id: 'CR-2026-1045',
    title: 'Uneven concrete walkway slab and broken bench near park east gate',
    description:
      'Two concrete paver slabs along the morning walking track have settled unevenly by 2 inches, and one wooden park bench slat needs replacement.',
    location: 'Nageswara Rao Park Perimeter, Luz Church Road, Mylapore, Chennai (13.0338° N, 80.2519° E)',
    userCategory: 'Parks & Public Spaces',
    status: 'Resolved',
    createdAt: '2026-11-17T09:00:00.000Z',
    updatedAt: '2026-11-19T16:45:00.000Z',
    upvotes: 14,
    officialNote:
      'Mylapore Parks maintenance team re-leveled both concrete walkway slabs with mortar bedding and replaced damaged bench timber slats on Nov 19.',
    aiTriage: {
      verified_category: 'Parks & Public Spaces',
      priority_level: 'Low',
      priority_reasoning:
        'Minor trip hazard on a pedestrian park track and damaged seating require scheduled maintenance rather than emergency intervention.',
      recommended_department: 'Parks & Urban Forestry Dept',
      ai_visual_verification: 'No image attached',
      actionable_summary:
        'Re-seat settled walkway paver slabs along the east gate track and replace broken timber slats on bench #7.',
    },
  },
];
