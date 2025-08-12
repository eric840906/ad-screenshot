# Error Handling Flow

```mermaid
flowchart TD
    Error[Error Occurs] --> Categorize[Categorize Error Type]
    
    Categorize --> NetworkError{Network Error?}
    Categorize --> TimeoutError{Timeout Error?}
    Categorize --> BrowserError{Browser Crash?}
    Categorize --> SelectorError{Selector Not Found?}
    Categorize --> UploadError{Upload Error?}
    Categorize --> AuthError{Authentication Error?}
    Categorize --> ParseError{Parsing Error?}
    Categorize --> UnknownError[Unknown Error]
    
    %% Network Error Path
    NetworkError -->|Yes| CheckNetworkRetries{Retries < 5?}
    CheckNetworkRetries -->|Yes| NetworkBackoff[Apply Network Backoff<br/>1s * 2^attempt, max 10s]
    CheckNetworkRetries -->|No| NetworkFailure[Mark as Network Failure]
    NetworkBackoff --> RetryJob[Add to Retry Queue]
    NetworkFailure --> LogError[Log Critical Error]
    
    %% Timeout Error Path  
    TimeoutError -->|Yes| CheckTimeoutRetries{Retries < 3?}
    CheckTimeoutRetries -->|Yes| TimeoutBackoff[Apply Timeout Backoff<br/>2s * 1.5^attempt, max 8s]
    CheckTimeoutRetries -->|No| TimeoutFailure[Mark as Timeout Failure]
    TimeoutBackoff --> RetryJob
    TimeoutFailure --> LogError
    
    %% Browser Error Path
    BrowserError -->|Yes| CheckBrowserHealth[Check Browser Health]
    CheckBrowserHealth --> BrowserHealthy{Browser Responsive?}
    BrowserHealthy -->|No| RestartBrowser[Restart Browser Session]
    BrowserHealthy -->|Yes| CheckBrowserRetries{Retries < 2?}
    RestartBrowser --> CheckBrowserRetries
    CheckBrowserRetries -->|Yes| BrowserBackoff[Apply Browser Backoff<br/>5s fixed delay]
    CheckBrowserRetries -->|No| BrowserFailure[Mark as Browser Failure]
    BrowserBackoff --> RetryJob
    BrowserFailure --> LogError
    
    %% Selector Error Path
    SelectorError -->|Yes| CheckSelectorRetries{Retries < 3?}
    CheckSelectorRetries -->|Yes| SelectorBackoff[Apply Selector Backoff<br/>2s * 1.5^attempt, max 8s]
    CheckSelectorRetries -->|No| SelectorFailure[Mark as Selector Failure]
    SelectorBackoff --> RetryJob
    SelectorFailure --> LogWarning[Log Warning - Update Selector]
    
    %% Upload Error Path
    UploadError -->|Yes| CheckUploadHealth[Check Google Drive Connection]
    CheckUploadHealth --> UploadHealthy{Drive Accessible?}
    UploadHealthy -->|No| UploadServiceDown[Google Drive Service Issue]
    UploadHealthy -->|Yes| CheckUploadRetries{Retries < 4?}
    UploadServiceDown --> CheckUploadRetries
    CheckUploadRetries -->|Yes| UploadBackoff[Apply Upload Backoff<br/>1.5s * 2^attempt, max 12s]
    CheckUploadRetries -->|No| UploadFailure[Keep Local Copy Only]
    UploadBackoff --> RetryUpload[Add to Upload Queue]
    UploadFailure --> LogWarning
    
    %% Authentication Error Path
    AuthError -->|Yes| CheckCredentials[Validate Credentials]
    CheckCredentials --> CredsValid{Credentials Valid?}
    CredsValid -->|No| AuthFailure[Critical Auth Failure]
    CredsValid -->|Yes| CheckAuthRetries{Retries < 2?}
    AuthFailure --> AlertAdmin[Send Admin Alert]
    CheckAuthRetries -->|Yes| AuthBackoff[Apply Auth Backoff<br/>10s fixed delay]
    CheckAuthRetries -->|No| AuthPermanentFailure[Permanent Auth Failure]
    AuthBackoff --> RetryJob
    AuthPermanentFailure --> AlertAdmin
    
    %% Parsing Error Path
    ParseError -->|Yes| CheckParseRetries{Retries < 1?}
    CheckParseRetries -->|Yes| ParseBackoff[Apply Parse Backoff<br/>1s fixed delay]
    CheckParseRetries -->|No| ParseFailure[Data Format Error]
    ParseBackoff --> RetryJob
    ParseFailure --> LogError
    
    %% Unknown Error Path
    UnknownError --> CheckUnknownRetries{Retries < 2?}
    CheckUnknownRetries -->|Yes| UnknownBackoff[Apply Default Backoff<br/>3s * 2^attempt, max 15s]
    CheckUnknownRetries -->|No| UnknownFailure[Mark as Unknown Failure]
    UnknownBackoff --> RetryJob
    UnknownFailure --> LogError
    
    subgraph "Circuit Breaker Logic"
        RetryJob --> CheckCircuitBreaker{Circuit Open?}
        CheckCircuitBreaker -->|Yes| CircuitOpen[Circuit Breaker Open<br/>Skip Retry]
        CheckCircuitBreaker -->|No| UpdateFailureCount[Update Failure Count]
        UpdateFailureCount --> CheckThreshold{Failure Threshold<br/>Exceeded?}
        CheckThreshold -->|Yes| OpenCircuit[Open Circuit Breaker<br/>Block Future Retries]
        CheckThreshold -->|No| ProcessRetry[Process Retry Job]
        CircuitOpen --> AlertCircuitOpen[Alert: Circuit Breaker Open]
        OpenCircuit --> AlertCircuitOpen
        ProcessRetry --> JobQueued[Job Added to Retry Queue]
    end
    
    subgraph "Recovery Mechanisms"
        RestartBrowser --> BrowserRecovery[Browser Recovery Process]
        BrowserRecovery --> CleanupSessions[Cleanup All Browser Sessions]
        CleanupSessions --> LaunchNewBrowser[Launch New Browser Instance]
        LaunchNewBrowser --> BrowserReady[Browser Ready for Jobs]
        
        AlertAdmin --> AdminNotification[Send Admin Email/Slack]
        AdminNotification --> LogCritical[Log Critical Issue]
        LogCritical --> RequireManualAction[Manual Intervention Required]
    end
    
    subgraph "Monitoring and Alerting"
        LogError --> CheckErrorRate[Check Error Rate]
        LogWarning --> CheckErrorRate
        CheckErrorRate --> ErrorRateHigh{Error Rate > 20%?}
        ErrorRateHigh -->|Yes| HighErrorAlert[Send High Error Rate Alert]
        ErrorRateHigh -->|No| ContinueMonitoring[Continue Monitoring]
        HighErrorAlert --> AlertAdmins[Alert System Administrators]
        
        JobQueued --> UpdateMetrics[Update Retry Metrics]
        UpdateMetrics --> MetricsComplete[Metrics Updated]
    end
    
    %% Final States
    MetricsComplete --> EndFlow[End Error Handling]
    BrowserReady --> EndFlow
    ContinueMonitoring --> EndFlow
    RequireManualAction --> EndFlow
    AlertAdmins --> EndFlow
    
    %% Styling
    classDef errorType fill:#ffebee,stroke:#c62828,stroke-width:2px
    classDef retryLogic fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px
    classDef circuitBreaker fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
    classDef recovery fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    classDef monitoring fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px
    classDef critical fill:#fce4ec,stroke:#880e4f,stroke-width:3px
    
    class NetworkError,TimeoutError,BrowserError,SelectorError,UploadError,AuthError,ParseError,UnknownError errorType
    class NetworkBackoff,TimeoutBackoff,BrowserBackoff,SelectorBackoff,UploadBackoff,AuthBackoff,ParseBackoff,UnknownBackoff,RetryJob retryLogic
    class CheckCircuitBreaker,CircuitOpen,OpenCircuit,UpdateFailureCount circuitBreaker
    class RestartBrowser,BrowserRecovery,CleanupSessions,LaunchNewBrowser recovery
    class CheckErrorRate,UpdateMetrics,HighErrorAlert monitoring
    class AuthFailure,AlertAdmin,RequireManualAction critical
```

## Error Handling Strategy

### Error Classification System

#### 1. Network Errors
- **Retry Strategy**: Up to 5 attempts with exponential backoff (1s × 2^attempt, max 10s)
- **Examples**: Connection timeouts, DNS failures, socket errors
- **Recovery**: Automatic retry with network health checks

#### 2. Timeout Errors  
- **Retry Strategy**: Up to 3 attempts with moderate backoff (2s × 1.5^attempt, max 8s)
- **Examples**: Page load timeouts, selector wait timeouts
- **Recovery**: Increase timeout thresholds progressively

#### 3. Browser Crashes
- **Retry Strategy**: Up to 2 attempts with browser restart
- **Examples**: Chrome crashes, page target closed
- **Recovery**: Complete browser session restart

#### 4. Selector Not Found
- **Retry Strategy**: Up to 3 attempts with moderate backoff
- **Examples**: Element not present, invalid CSS selectors
- **Recovery**: Log warning for manual selector review

#### 5. Upload Errors
- **Retry Strategy**: Up to 4 attempts with exponential backoff (1.5s × 2^attempt, max 12s)
- **Examples**: Google Drive API failures, network issues during upload
- **Recovery**: Maintain local copies, retry with connection checks

#### 6. Authentication Errors
- **Retry Strategy**: Up to 2 attempts with credential validation
- **Examples**: Invalid Google API credentials, expired tokens
- **Recovery**: Alert administrators immediately

#### 7. Parsing Errors
- **Retry Strategy**: 1 attempt only (data format issues)
- **Examples**: Invalid CSV format, corrupted data
- **Recovery**: Log error for data source review

### Circuit Breaker Implementation

#### States
- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Failures exceeded threshold, block requests
- **HALF_OPEN**: Test single request to check recovery

#### Thresholds
- **Failure Threshold**: 5 consecutive failures
- **Reset Timeout**: 30 seconds
- **Monitoring Period**: 5 minutes

### Recovery Mechanisms

#### Browser Recovery
1. **Detection**: Monitor for browser crash signals
2. **Cleanup**: Close all existing browser sessions
3. **Restart**: Launch new browser instance with fresh profile
4. **Validation**: Verify browser responsiveness before resuming

#### Service Recovery
1. **Health Checks**: Continuous monitoring of external services
2. **Graceful Degradation**: Disable non-critical features during outages
3. **Auto-Recovery**: Attempt service reconnection with backoff
4. **Manual Escalation**: Alert administrators for persistent issues

### Monitoring and Alerting

#### Error Rate Monitoring
- **Threshold**: Alert when error rate exceeds 20%
- **Window**: 15-minute rolling window
- **Actions**: Notify administrators via email/Slack

#### Critical Error Alerts
- **Authentication Failures**: Immediate admin notification
- **Circuit Breaker Opens**: System degradation alert
- **Browser Recovery**: Service restart notification

#### Metrics Collection
- **Error Types**: Count and categorize all errors
- **Retry Success Rate**: Monitor retry effectiveness
- **Recovery Time**: Track service restoration duration
- **Resource Usage**: Monitor browser session limits