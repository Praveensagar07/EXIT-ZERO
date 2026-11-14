import pytest
from app.models.building import BoundingBox, Doorway, Exit, Floor, Room, RoomType
from app.models.occupant import EvacuationState, MobilityCategory, Occupant
from app.models.scenario import AlgorithmType, AlgorithmWeights, ScenarioConfig


def test_building_models_validation():
    bounds = BoundingBox(x=10.0, y=10.0, width=20.0, height=15.0)
    room = Room(id="room_1", floor_id="floor_1", name="Test Room", bounds=bounds, room_type=RoomType.OFFICE)
    assert room.id == "room_1"
    assert room.bounds.width == 20.0

    door = Doorway(id="door_1", floor_id="floor_1", x=10.0, y=17.5, width=1.2, connects_rooms=["room_1"])
    assert door.is_open is True
    assert door.width == 1.2

    exit_elem = Exit(id="exit_1", floor_id="floor_1", name="Main Exit", x=0.0, y=17.5, width=2.0)
    assert exit_elem.is_wheelchair_accessible is True
    assert exit_elem.is_blocked is False


def test_occupant_model_validation():
    occ = Occupant(
        id="occ_001",
        floor_id="floor_1",
        x=15.0,
        y=15.0,
        current_node_id="node_room_1",
        movement_speed=1.35,
        free_speed=1.35,
        mobility_category=MobilityCategory.STANDARD,
        evacuation_state=EvacuationState.EVACUATING,
    )
    assert occ.id == "occ_001"
    assert occ.hazard_exposure == 0.0
    assert occ.distance_traveled == 0.0


def test_algorithm_weights_defaults():
    weights = AlgorithmWeights()
    assert weights.w_distance == 1.0
    assert weights.w_hazard == 8.0
    assert weights.hysteresis_threshold == 0.20
