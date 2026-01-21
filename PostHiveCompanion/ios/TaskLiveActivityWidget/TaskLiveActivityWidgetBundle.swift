
import WidgetKit
import SwiftUI

@main
struct TaskLiveActivityWidgetBundle: WidgetBundle {
    var body: some Widget {
        // Live Activities (Dynamic Island)
        TaskLiveActivityWidget()
        EventLiveActivityWidget()
        
        // Static Home Screen Widgets
        UpcomingWidget()
        DeliverableWidget()
        TransferWidget()
        ActivityWidget()
    }
}

