/**
 * Factors that were researched but could NOT be responsibly verified for
 * src/lib/data/emission-factors.json. Per the critical scientific-data rule,
 * no numeric value is fabricated here — this is a documented gap list only.
 * The engine must reject any calculation that requires one of these ids.
 */
export interface PendingFactor {
  id: string;
  material: string;
  category: string;
  reason: string;
  candidateSources: { name: string; url: string; note: string }[];
}

export const PENDING_FACTORS: PendingFactor[] = [
  {
    id: "virgin-pla-production",
    material: "Virgin PLA (polylactic acid) resin",
    category: "production",
    reason:
      "Published cradle-to-gate GHG figures for PLA disagree by roughly 5x depending on source " +
      "(NatureWorks' own Ingeo LCA reports approx. 0.62 kgCO2e/kg; independent literature reviews " +
      "cite a 1.5-3.5 kgCO2e/kg range) and at least one peer-reviewed meta-analysis flags the " +
      "low, industry-reported figure as dependent on optimistic renewable-electricity-mix and " +
      "biogenic-carbon-sequestration assumptions that are not disclosed consistently across " +
      "studies. Picking either number without resolving that methodological disagreement would " +
      "misrepresent the uncertainty — so it is left unverified rather than guessed.",
    candidateSources: [
      {
        name: "NatureWorks — Ingeo Eco-Profile / LCA data",
        url: "https://www.natureworksllc.com/~/media/Files/NatureWorks/What-is-Ingeo/Why-it-Matters/Eco-Profile/NTR_Eco_Profile_Industrial_Biotechnology_0614_pdf.pdf",
        note: "Primary industry source; self-reported by the sole major PLA producer, needs independent cross-check before use.",
      },
      {
        name: "ScienceDirect — meta-analysis of PLA LCA climate-change-impact studies",
        url: "https://www.sciencedirect.com/science/article/pii/S2352550924001507",
        note: "Independent review of the literature range; would need full-text review to select a defensible central estimate and range.",
      },
    ],
  },
  {
    id: "recycled-pp-production",
    material: "Recycled PP (polypropylene)",
    category: "production",
    reason:
      "EPA WARM v13 explicitly states the recycling pathway is only modeled for HDPE and PET " +
      "'due to LCI data limitations' and that life-cycle inventory data for other recycled " +
      "plastic resins, including PP, 'is not yet available.' No standalone cradle-to-gate " +
      "recycled-PP production factor from a comparably authoritative public source was found " +
      "during this research pass.",
    candidateSources: [
      {
        name: "US EPA WARM v13 Plastics chapter (states the limitation directly)",
        url: "https://archive.epa.gov/epawaste/conserve/tools/warm/pdfs/Plastics.pdf",
        note: "Confirms the gap; does not provide the missing factor.",
      },
    ],
  },
  {
    id: "pp-recycling-credit",
    material: "PP",
    category: "disposal (recycling pathway)",
    reason:
      "Same LCI data limitation as recycled-PP production above: WARM does not model a recycling " +
      "end-of-life pathway for PP, so no sourced 'recycling' disposal factor exists for it. " +
      "Landfill and combustion pathways for PP are available and included in emission-factors.json.",
    candidateSources: [
      {
        name: "US EPA WARM v13 Plastics chapter",
        url: "https://archive.epa.gov/epawaste/conserve/tools/warm/pdfs/Plastics.pdf",
        note: "Confirms the gap.",
      },
    ],
  },
];
