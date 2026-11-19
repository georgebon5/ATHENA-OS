# AUTO-GENERATED από packages/contracts/schemas — ΜΗΝ το αλλάξεις με το χέρι. Τρέξε `pnpm contracts:gen`.

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, RootModel, confloat, conint, constr


class AthenaContracts(BaseModel):
    pass


class DataSource(RootModel[Literal['live', 'replay', 'mock', 'down']]):
    root: Literal['live', 'replay', 'mock', 'down'] = Field(
        ...,
        description='Από πού ήρθαν τα δεδομένα: live, replay ηχογράφησης, fixtures (mock) ή εκτός λειτουργίας',
        title='DataSource',
    )


class Buses(BaseModel):
    active: int = Field(..., description='Λεωφορεία σε κίνηση μέσα στο bbox')
    lines: list[str]
    source: DataSource


class Weather(BaseModel):
    temperatureC: float | None
    apparentC: float | None
    source: str = Field(..., description='π.χ. open-meteo')


class Reports(BaseModel):
    total: int
    last24h: int
    byCategory: dict[str, int]


class CityLive(BaseModel):
    """
    GET /api/city/live — σύνοψη για να μιλήσει η ATHENA με live νούμερα
    """

    updatedAt: str
    buses: Buses
    weather: Weather
    reports: Reports


class Consultation(BaseModel):
    id: str
    scenarioId: str
    reportId: str | None = None
    beforeUrl: str
    afterUrl: str
    questionEl: str
    publicUrl: str = Field(..., description='Αυτό γίνεται QR')


class ConsultationCreate(BaseModel):
    """
    Body του POST /api/consultations. Τα id και publicUrl τα βάζει ο gateway.
    """

    scenarioId: str
    reportId: str | None = None
    beforeUrl: str
    afterUrl: str
    questionEl: str


class VoteChoice(RootModel[Literal['yes', 'no', 'maybe']]):
    root: Literal['yes', 'no', 'maybe'] = Field(..., title='VoteChoice')


class Citation(BaseModel):
    label: str
    source: str


class DecisionDraft(BaseModel):
    scenarioId: str
    markdownEl: str = Field(
        ...,
        description='ΘΕΜΑ / ΣΚΕΠΤΙΚΟ / ΔΕΔΟΜΕΝΑ / ΔΙΑΒΟΥΛΕΥΣΗ / ΑΠΟΦΑΣΙΖΕΙ, με ένδειξη «ΣΧΕΔΙΟ»',
    )
    citations: list[Citation]


class DemoBeat(
    RootModel[
        Literal['INTRO', 'PITCH', 'SENSE', 'SIMULATE', 'ENGAGE', 'DECISION', 'CLOSE']
    ]
):
    root: Literal[
        'INTRO', 'PITCH', 'SENSE', 'SIMULATE', 'ENGAGE', 'DECISION', 'CLOSE'
    ] = Field(..., title='DemoBeat')


class LayerKey(RootModel[Literal['traffic', 'thermal', 'reports', 'votes', 'buses']]):
    root: Literal['traffic', 'thermal', 'reports', 'votes', 'buses'] = Field(
        ..., title='LayerKey'
    )


class AgentMood(RootModel[Literal['neutral', 'alert', 'proud']]):
    root: Literal['neutral', 'alert', 'proud'] = Field(..., title='AgentMood')


class ReportHiddenPayload(BaseModel):
    """
    ΠΡΟΤΑΣΗ Dev4: ο director κρύβει ακατάλληλη φωτογραφία (moderation)
    """

    id: str


class AgentSayPayload(BaseModel):
    textEl: str
    audioUrl: str | None = None
    mood: AgentMood | None = None


class AgentThinkingPayload(BaseModel):
    stepEl: str


class LayerSetPayload(BaseModel):
    layer: LayerKey
    visible: bool


class TimeSetPayload(BaseModel):
    when: str = Field(..., description='ISO 8601')


class SimProgressPayload(BaseModel):
    scenarioId: str
    pct: confloat(ge=0.0, le=1.0) = Field(..., description='Κλάσμα 0–1')


class BacktestShowPayload(BaseModel):
    model: Literal['traffic', 'thermal']


class DirectorBeatPayload(BaseModel):
    beat: DemoBeat


class ServiceState(RootModel[Literal['up', 'down', 'mock']]):
    root: Literal['up', 'down', 'mock'] = Field(..., title='ServiceState')


class SystemServices(BaseModel):
    db: Literal['postgres', 'sqlite']
    sim: ServiceState
    agent: ServiceState
    oasa: DataSource


class SystemStatus(BaseModel):
    """
    ΠΡΟΤΑΣΗ Dev4: κατάσταση υπηρεσιών. Το web το δείχνει μόνο στο director panel, ποτέ στο κοινό.
    """

    at: str
    services: SystemServices = Field(..., title='SystemServices')
    fallbacks: list[str] = Field(
        ...,
        description='Πρόσφατα fallbacks, στα ελληνικά. Δείχνονται ΜΟΝΟ στον director.',
    )


class StateResetPayload(BaseModel):
    """
    ΠΡΟΤΑΣΗ Dev4: ο director έκανε reset για νέα πρόβα. Ο client καθαρίζει σενάριο/ψήφους/απόφαση.
    """


class ReportHiddenEvent(BaseModel):
    type: Literal['report.hidden']
    payload: ReportHiddenPayload
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class AgentSayEvent(BaseModel):
    type: Literal['agent.say']
    payload: AgentSayPayload
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class AgentThinkingEvent(BaseModel):
    type: Literal['agent.thinking']
    payload: AgentThinkingPayload
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class LayerSetEvent(BaseModel):
    type: Literal['layer.set']
    payload: LayerSetPayload
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class TimeSetEvent(BaseModel):
    type: Literal['time.set']
    payload: TimeSetPayload
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class SimProgressEvent(BaseModel):
    type: Literal['sim.progress']
    payload: SimProgressPayload
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class BacktestShowEvent(BaseModel):
    type: Literal['backtest.show']
    payload: BacktestShowPayload
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class ConsultationOpenedEvent(BaseModel):
    type: Literal['consultation.opened']
    payload: Consultation
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class DecisionReadyEvent(BaseModel):
    type: Literal['decision.ready']
    payload: DecisionDraft
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class DirectorBeatEvent(BaseModel):
    type: Literal['director.beat']
    payload: DirectorBeatPayload
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class SystemStatusEvent(BaseModel):
    type: Literal['system.status']
    payload: SystemStatus
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class StateResetEvent(BaseModel):
    type: Literal['state.reset']
    payload: StateResetPayload
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class LngLat(RootModel[list[float]]):
    """
    [lng, lat] σε WGS84
    """

    root: list[float] = Field(
        ...,
        description='[lng, lat] σε WGS84',
        max_length=2,
        min_length=2,
        title='LngLat',
    )


class Range(BaseModel):
    """
    Εύρος αβεβαιότητας. Κανένα νούμερο στην οθόνη χωρίς εύρος.
    """

    p10: float
    p50: float
    p90: float


class AgentPrompt(BaseModel):
    """
    web → gateway POST /api/agent/prompt → agent POST {AGENT_URL}/prompt
    """

    textEl: str


class MediaUploadResult(BaseModel):
    """
    Απάντηση του POST /api/media (εικόνες after, audio του TTS)
    """

    url: str


class ReportCategory(
    RootModel[
        Literal[
            'pothole',
            'sidewalk_damage',
            'waste',
            'lighting',
            'obstruction',
            'heat_exposure',
            'graffiti',
            'accessibility',
            'other',
        ]
    ]
):
    root: Literal[
        'pothole',
        'sidewalk_damage',
        'waste',
        'lighting',
        'obstruction',
        'heat_exposure',
        'graffiti',
        'accessibility',
        'other',
    ] = Field(..., title='ReportCategory')


class ReportClassification(BaseModel):
    category: ReportCategory
    severity: Literal[1, 2, 3, 4, 5]
    summaryEl: str = Field(..., description='Μία πρόταση στα ελληνικά')
    department: str = Field(..., description='Αρμόδια υπηρεσία του Δήμου')
    duplicates: list[str] = Field(..., description='Report ids')
    confidence: confloat(ge=0.0, le=1.0)


class Report(BaseModel):
    id: str
    createdAt: str = Field(..., description='ISO 8601')
    photoUrl: str
    location: LngLat
    heading: confloat(ge=0.0, le=360.0) | None = Field(
        ..., description='Μοίρες 0–360 από πυξίδα (0 = βορράς, δεξιόστροφα)'
    )
    accuracyM: confloat(ge=0.0) | None
    classification: ReportClassification | None = None


class WayIds(RootModel[list[int]]):
    """
    OSM way ids
    """

    root: list[int] = Field(..., description='OSM way ids', title='WayIds')


class CloseRoadEdit(BaseModel):
    type: Literal['close_road']
    wayIds: WayIds


class BusLaneEdit(BaseModel):
    """
    Αφαιρεί μία λωρίδα ΙΧ και τη δίνει στα λεωφορεία
    """

    type: Literal['bus_lane']
    wayIds: WayIds


class RemoveLaneEdit(BaseModel):
    type: Literal['remove_lane']
    wayIds: WayIds


class AddTreesEdit(BaseModel):
    type: Literal['add_trees']
    geometry: list[LngLat]
    count: conint(ge=1)
    side: Literal['north', 'south', 'east', 'west', 'both'] | None = None


class CoolPavementEdit(BaseModel):
    type: Literal['cool_pavement']
    wayIds: WayIds


class ScenarioEdit(
    RootModel[
        CloseRoadEdit | BusLaneEdit | RemoveLaneEdit | AddTreesEdit | CoolPavementEdit
    ]
):
    root: (
        CloseRoadEdit | BusLaneEdit | RemoveLaneEdit | AddTreesEdit | CoolPavementEdit
    ) = Field(..., title='ScenarioEdit')


class Scenario(BaseModel):
    id: str
    title: str = Field(
        ..., description='π.χ. «Δέντρα και λωρίδα λεωφορείου στην Πειραιώς»'
    )
    edits: list[ScenarioEdit]
    when: str = Field(..., description='ISO 8601 — για θερμικό/ήλιο (slider)')
    origin: Literal['user', 'agent_variant']
    parentId: str | None = Field(None, description='Για παραλλαγές του agent')


class TrafficSegment(BaseModel):
    wayId: int
    baseFlow: float
    newFlow: float
    baseTimeS: float
    newTimeS: float
    path: list[LngLat] | None = Field(
        None,
        description='Προαιρετικό geometry. Αν λείπει, ο client το αντιστοιχεί τοπικά.',
    )


class Trip(BaseModel):
    path: list[LngLat]
    departS: float
    durationS: float


class ThermalCell(BaseModel):
    lngLat: LngLat
    baseC: float
    newC: float


class Traffic(BaseModel):
    segments: list[TrafficSegment]
    corridorTravelTimeDeltaPct: Range
    vehicleKmDeltaPct: Range
    trips: list[Trip] = Field(..., max_length=3000)


class Thermal(BaseModel):
    when: str
    cells: list[ThermalCell] = Field(..., description='Πλέγμα ~20–30 m')
    hotspotDeltaC: Range


class Emissions(BaseModel):
    co2DeltaPct: Range


class SimResult(BaseModel):
    scenarioId: str
    status: Literal['ok', 'error']
    computeMs: float
    traffic: Traffic
    thermal: Thermal
    emissions: Emissions
    notes: list[str] = Field(..., description='Παραδοχές, στα ελληνικά')


class ChartItem(BaseModel):
    predicted: float
    observed: float


class Backtest(BaseModel):
    model: Literal['traffic', 'thermal']
    metric: Literal['MAPE', 'MAE_C', 'R2']
    value: float
    heldOut: str = Field(
        ..., description='π.χ. «Τρίτη 17/11, 07:00–10:00» ή «Landsat 14/07/2025»'
    )
    nSamples: int
    chart: list[ChartItem]


class Bus(BaseModel):
    id: str = Field(..., description='Αριθμός οχήματος ΟΑΣΑ')
    line: str = Field(..., description='π.χ. 049, 914, Β18')
    lngLat: LngLat
    bearing: float = Field(..., description='Μοίρες 0–360')


class Vote(BaseModel):
    """
    Body του POST /api/consultations/{id}/votes. location = προαιρετικά η γειτονιά του ψηφοφόρου.
    """

    consultationId: str
    choice: VoteChoice
    location: LngLat | None = None
    comment: constr(max_length=500) | None = None


class VotePoint(BaseModel):
    lngLat: LngLat
    choice: VoteChoice


class VoteTally(BaseModel):
    consultationId: str
    yes: conint(ge=0)
    no: conint(ge=0)
    maybe: conint(ge=0)
    points: list[VotePoint]


class BusesUpdatePayload(BaseModel):
    buses: list[Bus]


class CameraFlyToPayload(BaseModel):
    lngLat: LngLat
    heightM: float
    headingDeg: float
    pitchDeg: float
    durationS: confloat(ge=0.0)
    shot: str | None = Field(
        None, description='Όνομα προκαθορισμένου πλάνου του web (π.χ. orbitSerafio)'
    )


class VariantComparePayload(BaseModel):
    base: SimResult
    best: SimResult
    reasonEl: str


class BusesUpdateEvent(BaseModel):
    type: Literal['buses.update']
    payload: BusesUpdatePayload
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class ReportCreatedEvent(BaseModel):
    type: Literal['report.created']
    payload: Report
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class ReportClassifiedEvent(BaseModel):
    type: Literal['report.classified']
    payload: Report
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class CameraFlyToEvent(BaseModel):
    type: Literal['camera.flyTo']
    payload: CameraFlyToPayload
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class ScenarioCreatedEvent(BaseModel):
    type: Literal['scenario.created']
    payload: Scenario
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class SimResultEvent(BaseModel):
    type: Literal['sim.result']
    payload: SimResult
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class VariantCompareEvent(BaseModel):
    type: Literal['variant.compare']
    payload: VariantComparePayload
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class VoteTallyEvent(BaseModel):
    type: Literal['vote.tally']
    payload: VoteTally
    replay: bool | None = Field(
        None,
        description='true όταν ο gateway ξαναστέλνει την κατάσταση σε νέο client (χωρίς animation/ήχο)',
    )


class WsEvent(
    RootModel[
        BusesUpdateEvent
        | ReportCreatedEvent
        | ReportClassifiedEvent
        | ReportHiddenEvent
        | AgentSayEvent
        | AgentThinkingEvent
        | CameraFlyToEvent
        | LayerSetEvent
        | TimeSetEvent
        | ScenarioCreatedEvent
        | SimProgressEvent
        | SimResultEvent
        | VariantCompareEvent
        | BacktestShowEvent
        | ConsultationOpenedEvent
        | VoteTallyEvent
        | DecisionReadyEvent
        | DirectorBeatEvent
        | SystemStatusEvent
        | StateResetEvent
    ]
):
    root: (
        BusesUpdateEvent
        | ReportCreatedEvent
        | ReportClassifiedEvent
        | ReportHiddenEvent
        | AgentSayEvent
        | AgentThinkingEvent
        | CameraFlyToEvent
        | LayerSetEvent
        | TimeSetEvent
        | ScenarioCreatedEvent
        | SimProgressEvent
        | SimResultEvent
        | VariantCompareEvent
        | BacktestShowEvent
        | ConsultationOpenedEvent
        | VoteTallyEvent
        | DecisionReadyEvent
        | DirectorBeatEvent
        | SystemStatusEvent
        | StateResetEvent
    ) = Field(
        ..., description='Κάθε μήνυμα στο /ws: { type, payload }', title='WsEvent'
    )


class NearbyReport(BaseModel):
    id: str
    distanceM: float
    category: ReportCategory | None = None


class ClassifyRequest(BaseModel):
    """
    gateway → agent: POST {AGENT_URL}/classify. Απάντηση: ReportClassification.
    """

    report: Report
    imageBase64: str = Field(..., description='Η φωτογραφία (ήδη resized ~1600px)')
    mimeType: str
    nearby: list[NearbyReport] = Field(
        ...,
        description='Αναφορές σε ακτίνα 50 m (PostGIS), για να γεμίσει το duplicates',
    )
