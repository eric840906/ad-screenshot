# System Architecture Diagram

```mermaid
graph TB
    subgraph "External Data Sources"
        CSV[CSV Files]
        GSheets[Google Sheets]
    end

    subgraph "Core Services"
        DIS[DataIngestionService]
        QM[QueueManager]
        BAE[BrowserAutomationEngine]
        BE[BookmarkletExecutor]
        CEB[ChromeExtensionBridge]
        SM[ScreenshotManager]
        FSS[FileStorageService]
        US[UploadService]
        LS[LoggingService]
        PP[ProcessingPipeline]
        EH[ErrorHandler]
    end

    subgraph "External Dependencies"
        Redis[(Redis Queue)]
        Chrome[Chrome Browser]
        ChromeExt[Chrome Extension]
        GDrive[Google Drive API]
        LocalStorage[Local File System]
    end

    subgraph "Infrastructure"
        Cron[Cron Scheduler]
        Health[Health Check System]
        Alerts[Alerting System]
        Metrics[Metrics Collection]
    end

    %% Data flow
    CSV --> DIS
    GSheets --> DIS
    DIS --> PP
    PP --> QM
    
    QM --> Redis
    QM --> BAE
    BAE --> Chrome
    BAE --> BE
    BAE --> CEB
    CEB --> ChromeExt
    
    PP --> SM
    SM --> FSS
    FSS --> LocalStorage
    SM --> US
    US --> GDrive
    
    %% Service relationships
    PP --> LS
    PP --> EH
    EH --> LS
    
    %% Infrastructure monitoring
    Health --> PP
    Health --> Alerts
    Metrics --> Alerts
    Cron --> PP
    
    %% Styling
    classDef service fill:#e1f5fe,stroke:#0277bd,stroke-width:2px
    classDef external fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef infrastructure fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef storage fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    
    class DIS,QM,BAE,BE,CEB,SM,FSS,US,LS,PP,EH service
    class CSV,GSheets,Chrome,ChromeExt,GDrive external
    class Cron,Health,Alerts,Metrics infrastructure
    class Redis,LocalStorage storage
```

## Service Responsibilities

### Core Services
- **ProcessingPipeline**: Orchestrates the entire workflow and manages service coordination
- **DataIngestionService**: Parses CSV files and Google Sheets data into AdRecord objects
- **QueueManager**: Manages job queues using Redis Bull queues with retry logic
- **BrowserAutomationEngine**: Controls Chrome browser instances with mobile emulation
- **BookmarkletExecutor**: Executes JavaScript bookmarklets in browser contexts
- **ChromeExtensionBridge**: Communicates with Chrome Extension for advanced screenshots
- **ScreenshotManager**: Processes screenshots with Sharp image manipulation
- **FileStorageService**: Manages local file storage with organized folder structures
- **UploadService**: Handles Google Drive uploads with folder organization
- **LoggingService**: Provides structured logging with Winston
- **ErrorHandler**: Implements retry strategies, circuit breakers, and error categorization

### External Dependencies
- **Redis**: Queue management and job persistence
- **Chrome Browser**: Web page rendering and screenshot capture
- **Chrome Extension**: Advanced screenshot capabilities and element highlighting
- **Google Drive API**: Cloud storage for screenshots with automated folder organization
- **Local File System**: Temporary storage and backup location

### Infrastructure Components
- **Cron Scheduler**: Automated batch processing triggers
- **Health Check System**: Service monitoring and status reporting
- **Alerting System**: Multi-channel notifications (Email, Slack, Discord)
- **Metrics Collection**: Performance monitoring and analytics