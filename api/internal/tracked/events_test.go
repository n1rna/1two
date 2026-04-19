package tracked

import (
	"testing"
	"time"
)

// A published event should reach a subscriber for the same userID and not
// leak to subscribers for other userIDs.
func TestBus_SubscribePublish(t *testing.T) {
	bus := NewBus()

	chA, cancelA := bus.Subscribe("user-a")
	defer cancelA()
	chB, cancelB := bus.Subscribe("user-b")
	defer cancelB()

	bus.Publish(RunEvent{UserID: "user-a", Run: RunSnapshot{ID: "run-1"}})

	select {
	case ev := <-chA:
		if ev.Run.ID != "run-1" {
			t.Errorf("subscriber a got wrong run id: %q", ev.Run.ID)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("subscriber a timed out waiting for event")
	}

	select {
	case ev := <-chB:
		t.Fatalf("subscriber b should not have received user-a event, got %+v", ev)
	case <-time.After(50 * time.Millisecond):
		// ok — no event for unrelated user
	}
}

// Cancel removes the subscription — no further events should arrive on the
// closed channel, and Publish for other users should not block.
func TestBus_Unsubscribe(t *testing.T) {
	bus := NewBus()
	ch, cancel := bus.Subscribe("user-a")

	// Cancel then publish — cancel closes the channel so the receive
	// returns the zero value + !ok.
	cancel()

	bus.Publish(RunEvent{UserID: "user-a", Run: RunSnapshot{ID: "run-1"}})

	select {
	case _, ok := <-ch:
		if ok {
			t.Fatalf("expected channel to be closed after cancel")
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatal("read on cancelled channel did not return")
	}
}

// Multiple subscribers on the same userID all see each event.
func TestBus_FanOut(t *testing.T) {
	bus := NewBus()

	ch1, cancel1 := bus.Subscribe("u")
	defer cancel1()
	ch2, cancel2 := bus.Subscribe("u")
	defer cancel2()

	bus.Publish(RunEvent{UserID: "u", Run: RunSnapshot{ID: "x"}})

	for i, ch := range []<-chan RunEvent{ch1, ch2} {
		select {
		case ev := <-ch:
			if ev.Run.ID != "x" {
				t.Errorf("subscriber %d: wrong id %q", i, ev.Run.ID)
			}
		case <-time.After(500 * time.Millisecond):
			t.Fatalf("subscriber %d: timeout", i)
		}
	}
}

// Publishing with no subscribers is a no-op; Publish with ev.UserID=""
// should also be a no-op (defensive — tracked.Run guards against this but
// the bus should not panic).
func TestBus_PublishNoSubscribers(t *testing.T) {
	bus := NewBus()
	bus.Publish(RunEvent{UserID: "nobody"})
	bus.Publish(RunEvent{})
	// nothing to assert — test passes if we don't panic or hang
}

// A slow subscriber should not block Publish. The buffer is 16; after it
// fills, events are dropped (test sends 32, expects at most 16).
func TestBus_SlowSubscriberDoesNotBlock(t *testing.T) {
	bus := NewBus()
	_, cancel := bus.Subscribe("u")
	defer cancel()

	done := make(chan struct{})
	go func() {
		for i := 0; i < 32; i++ {
			bus.Publish(RunEvent{UserID: "u", Run: RunSnapshot{ID: "r"}})
		}
		close(done)
	}()

	select {
	case <-done:
		// good — publishes didn't block even though subscriber never reads.
	case <-time.After(500 * time.Millisecond):
		t.Fatal("Publish blocked on slow subscriber")
	}
}
