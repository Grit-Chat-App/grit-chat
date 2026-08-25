Feature: Grit Chat on one iPhone simulator
  In order to reach people with no infrastructure
  As someone holding this device
  I want the flows that have already been proven by hand to stay proven

  # This suite is the regression net for rungs 0, 1 and 1c, which are green on the simulator today.
  # Scenarios are split by what they need:
  #
  #   plain        drive only the app: screens, forms, and the honesty statements
  #   @needs-relay spawn hop-relayd (empty store) and this repo's grit-relay-node as the second
  #                party, so a message and a channel publication cross between two real nodes
  #
  # Every assertion addresses a testID, never copy or position. e2e/testids.test.js asserts every
  # one of those ids exists in the app, so a rename breaks a fast guard instead of a slow run.
  #
  # What this suite deliberately does not claim: anything on a handset, anything on a radio, and
  # anything Android. Those are documented absences, not skipped scenarios.

  Background:
    Given the app has launched

  @smoke
  Scenario: The first screen is designed emptiness
    Then I see the empty conversation state
    And the first action offers scanning someone
    And the first action offers my address
    And the first action offers adding someone
    And the relay indicator is present
    And the relay indicator explains itself when asked

  @smoke
  Scenario: A contact added by address becomes a conversation
    When I add "GrfdBYiMsvMvRFeZ4BVmRzXQ8sivHB4wYtQ9pKcTn3Ab" as "the studio"
    Then I am in the conversation with "the studio"
    When I go back
    Then my list has a conversation for "the studio"
    And its address is shown shortened

  @smoke
  Scenario: A bad address is refused with the reason shown
    When I try to add "not-a-real-address"
    Then the form tells me the address is not valid

  @needs-relay
  Scenario: A message I send is delivered with its hop count
    Given a relay and a listening peer
    When I add that peer as "the listener"
    And I send "meet at the trash fence"
    Then the message shows it is in flight
    And it is delivered via 2 hops

  @needs-relay
  Scenario: A channel carries a publication with its writer
    Given a relay is running
    And I host the channel "center-camp"
    When I publish "sunrise sync at six"
    Then it shows published
    When the channel peer joins and I publish "dawn flag goes up"
    Then the reply arrives with its writer

  @needs-relay
  Scenario: A voice note I record is delivered
    Given a relay and a listening peer
    When I add that peer as "the listener"
    And I record a voice note for 2 seconds
    Then the voice note shows it is in flight
    And it is delivered via 2 hops
    And the voice note renders with a play control

  @needs-relay
  Scenario: A photo arrives with the route it took
    Given a relay is running
    When the peer sends me a photo
    Then the photo renders
    And its trace shows the hops it took

  @needs-relay
  Scenario: A join request waits for the host's approval
    Given a relay is running
    And I host the channel "quiet-hall" with approval
    When the peer asks to join
    Then its request waits in my manage screen
    When I approve the request
    And I publish "the door is open"
    Then the reply arrives with its writer

  @needs-relay
  Scenario: An invite is accepted, and removal is a rotation not an unsend
    Given a relay is running
    And I host the channel "vip-room" as invite only
    When I invite the peer from the manage screen
    Then the peer accepts
    When I publish "first post"
    Then the reply arrives with its writer
    When I remove the member
    And I publish "after the removal"
    Then the peer receives nothing more

  # @needs-gps scenarios need a real CoreLocation fix. On this simulator none is ever delivered
  # (the app's CLLocationManager only ever issues stopUpdatingLocation under a pre-granted
  # permission; locationd log evidence is in PATH.md), so they run on hardware, not here. The
  # scenarios stay as specifications: their steps exist, the guard covers their ids, and the
  # flows they drive are proven piecewise (delivery by the text/media scenarios, rendering by the
  # inbound-location unit path, the math by real-world vectors).

  @needs-relay @needs-gps
  Scenario: A location I share is delivered like any message
    Given my simulated position is set
    And a relay and a listening peer
    When I add that peer as "the listener"
    And I share my location
    Then the location bubble shows the coordinates
    And it is delivered via 2 hops

  @needs-relay
  Scenario: A location from a peer renders with its accuracy
    And a relay is running
    When the peer sends me a location
    Then the location bubble shows the coordinates

  @needs-relay @needs-gps
  Scenario: A location from a peer shows how far it is
    Given my simulated position is set
    And a relay is running
    When the peer sends me a location
    Then the distance from my position is shown

  Scenario: Refused location permission is said plainly
    When I add "GrfdBYiMsvMvRFeZ4BVmRzXQ8sivHB4wYtQ9pKcTn3Ab" as "the studio"
    And I refuse location permission
    And I try to share my location
    Then the app tells me permission is off

  Scenario: Sharing into a channel names the fan-out
    When I host the channel "camp-notes"
    And I ask to share my location there
    Then the channel names everyone will see it
    When I cancel sharing
    Then the confirmation is gone

  @smoke
  Scenario: Clearing the relay tells the truth
    When I clear the relay endpoint
    Then the relay indicator says it is not set

  @smoke
  Scenario: The scanner is real, and paste is still the way in over a radio
    When I open add contact
    And I open the scanner
    Then the scanner view is on screen
    When I return to add contact
    Then the paste path is still offered
