# Automation Process Flowchart

```mermaid
flowchart TD
    Start([Start Batch Processing]) --> LoadData[Load CSV/Google Sheets Data]
    LoadData --> ParseData{Parse Data Successfully?}
    
    ParseData -->|No| ParseError[Log Parsing Error]
    ParseError --> End([End Process])
    
    ParseData -->|Yes| FilterRecords[Filter by Device Types]
    FilterRecords --> CreateJobs[Create Processing Jobs]
    CreateJobs --> AddToQueue[Add Jobs to Redis Queue]
    
    AddToQueue --> QueueWorker[Queue Worker Picks Up Job]
    
    subgraph "Job Processing"
        QueueWorker --> CreateSession[Create Browser Session]
        CreateSession --> SessionOk{Session Created?}
        
        SessionOk -->|No| SessionError[Handle Session Error]
        SessionError --> RetryDecision{Retry Job?}
        
        SessionOk -->|Yes| NavigateURL[Navigate to Website URL]
        NavigateURL --> NavOk{Navigation OK?}
        
        NavOk -->|No| NavError[Handle Navigation Error]
        NavError --> RetryDecision
        
        NavOk -->|Yes| CheckBookmarklet{Bookmarklet Required?}
        CheckBookmarklet -->|Yes| ExecuteBookmarklet[Execute Bookmarklet]
        CheckBookmarklet -->|No| WaitForSelector[Wait for CSS Selector]
        
        ExecuteBookmarklet --> BookmarkletOk{Bookmarklet Success?}
        BookmarkletOk -->|No| BookmarkletError[Log Bookmarklet Warning]
        BookmarkletError --> WaitForSelector
        BookmarkletOk -->|Yes| WaitForSelector
        
        WaitForSelector --> SelectorFound{Selector Found?}
        SelectorFound -->|No| SelectorTimeout[Selector Timeout Error]
        SelectorTimeout --> RetryDecision
        
        SelectorFound -->|Yes| Delay[Screenshot Delay]
        Delay --> TakeScreenshot[Take Screenshot]
        
        TakeScreenshot --> ScreenshotOk{Screenshot OK?}
        ScreenshotOk -->|No| ScreenshotError[Handle Screenshot Error]
        ScreenshotError --> RetryDecision
        
        ScreenshotOk -->|Yes| ProcessImage[Process Image with Sharp]
        ProcessImage --> SaveLocal[Save to Local Storage]
        SaveLocal --> SaveOk{Save Successful?}
        
        SaveOk -->|No| SaveError[Handle Save Error]
        SaveError --> RetryDecision
        
        SaveOk -->|Yes| CheckUpload{Upload Enabled?}
        CheckUpload -->|No| JobComplete[Mark Job Complete]
        CheckUpload -->|Yes| QueueUpload[Queue Upload Job]
        QueueUpload --> JobComplete
    end
    
    JobComplete --> CleanupSession[Cleanup Browser Session]
    CleanupSession --> CheckBatch{More Jobs in Batch?}
    
    RetryDecision -->|Yes, < Max Retries| RetryQueue[Add to Retry Queue]
    RetryDecision -->|No, Max Retries Reached| JobFailed[Mark Job Failed]
    
    RetryQueue --> ExponentialBackoff[Apply Exponential Backoff]
    ExponentialBackoff --> QueueWorker
    
    JobFailed --> CleanupSession
    
    CheckBatch -->|Yes| Continue[Continue Processing]
    Continue --> QueueWorker
    CheckBatch -->|No| ProcessUploads[Process Upload Queue]
    
    subgraph "Upload Processing"
        ProcessUploads --> UploadWorker[Upload Worker]
        UploadWorker --> CreateFolders[Create Google Drive Folders]
        CreateFolders --> FolderOk{Folders Created?}
        
        FolderOk -->|No| FolderError[Handle Folder Error]
        FolderError --> UploadRetry{Retry Upload?}
        
        FolderOk -->|Yes| UploadFile[Upload File to Drive]
        UploadFile --> UploadSuccess{Upload Success?}
        
        UploadSuccess -->|No| UploadError[Handle Upload Error]
        UploadError --> UploadRetry
        UploadSuccess -->|Yes| UpdateMetadata[Update File Metadata]
        
        UploadRetry -->|Yes| RetryUpload[Retry Upload with Backoff]
        UploadRetry -->|No| UploadFailed[Mark Upload Failed]
        
        RetryUpload --> UploadFile
        UpdateMetadata --> UploadComplete[Upload Complete]
        UploadFailed --> UploadComplete
        UploadComplete --> CheckMoreUploads{More Uploads?}
        
        CheckMoreUploads -->|Yes| UploadWorker
        CheckMoreUploads -->|No| BatchComplete[Batch Processing Complete]
    end
    
    BatchComplete --> GenerateReport[Generate Batch Report]
    GenerateReport --> LogResults[Log Final Results]
    LogResults --> End
    
    %% Error Handling Styles
    classDef error fill:#ffebee,stroke:#c62828,stroke-width:2px
    classDef success fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px
    classDef decision fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
    classDef process fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef queue fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px
    
    class ParseError,SessionError,NavError,SelectorTimeout,ScreenshotError,SaveError,JobFailed,FolderError,UploadError,UploadFailed error
    class JobComplete,BatchComplete,UploadComplete success
    class ParseData,SessionOk,NavOk,BookmarkletOk,SelectorFound,ScreenshotOk,SaveOk,CheckUpload,RetryDecision,CheckBatch,FolderOk,UploadSuccess,UploadRetry,CheckMoreUploads decision
    class LoadData,FilterRecords,CreateJobs,CreateSession,NavigateURL,ExecuteBookmarklet,WaitForSelector,TakeScreenshot,ProcessImage,SaveLocal,CreateFolders,UploadFile,UpdateMetadata,GenerateReport process
    class AddToQueue,QueueWorker,RetryQueue,QueueUpload,UploadWorker queue
```

## Process Flow Details

### Phase 1: Data Ingestion and Job Creation
1. **Load Data**: Parse CSV files or fetch Google Sheets data
2. **Filter Records**: Apply device type filters if specified
3. **Create Jobs**: Convert records into processing jobs with unique IDs
4. **Queue Management**: Add jobs to Redis queues with priority levels

### Phase 2: Screenshot Processing
1. **Browser Session**: Create isolated Chrome browser session with device emulation
2. **Navigation**: Navigate to target URL with timeout protection
3. **Bookmarklet Execution**: Inject and execute JavaScript if required
4. **Element Detection**: Wait for CSS selector with configurable timeout
5. **Screenshot Capture**: Take high-quality screenshot with Sharp processing
6. **Local Storage**: Save with organized naming convention

### Phase 3: Upload Processing
1. **Google Drive Integration**: Create organized folder structure
2. **File Upload**: Transfer screenshots to cloud storage
3. **Metadata Management**: Set file descriptions and organize by date/platform

### Phase 4: Error Handling and Retry Logic
1. **Error Categorization**: Classify errors by type (network, timeout, selector, etc.)
2. **Retry Strategy**: Apply appropriate backoff algorithms
3. **Circuit Breaker**: Prevent cascade failures
4. **Cleanup**: Ensure resources are properly released

### Performance Characteristics
- **Concurrency**: 3-5 parallel browser sessions (configurable)
- **Batch Size**: 50+ records per batch with memory optimization
- **Retry Logic**: Up to 3 attempts with exponential backoff
- **Timeout Protection**: Multiple timeout layers for reliability