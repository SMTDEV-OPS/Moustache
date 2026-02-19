erDiagram
    %% Identity & Access Management
    USER ||--o{ ROLE : "assigned"
    USER ||--o{ REGION : "assigned_to"
    USER ||--o| USER : "buddy_assigned"
    USER ||--o{ EMPLOYEE_GROUP : "belongs_to"

    %% Core CRM Entities
    ACCOUNT }o--|| CONGLOMERATE : "belongs_to"
    ACCOUNT ||--o{ ACCOUNT : "parent_hierarchy"
    ACCOUNT ||--o{ CONTACT : "has"
    ACCOUNT ||--o{ USER : "managed_by"
    
    %% Sales & Lead Management
    LEAD }o--|| ACCOUNT : "associated_with"
    LEAD }o--|| GUEST : "is_for"
    LEAD }o--|| PROPERTY : "enquiry_for"
    LEAD }o--|| USER : "assigned_to"
    LEAD ||--o{ QUOTATION : "generates"
    LEAD ||--o{ COMMUNICATION : "logged_actions"
    
    %% Operations
    RESERVATION }o--|| LEAD : "converted_from"
    TICKET }o--|| USER : "assigned_to"
    TICKET ||--o{ TICKET_ACTIVITY : "tracks"
    
    %% Core Schema Definitions
    USER {
        string name
        string email
        string teamType
        objectId roleId
        boolean isOnline
    }
    
    ACCOUNT {
        string name
        string organizationType
        string accountLevel
        objectId parentAccountId
        objectId conglomerateId
        string industryCategory
    }
    
    LEAD {
        string leadNumber
        string status
        string heatLevel
        date checkInDate
        objectId assignedToUserId
    }
    
    CONTACT {
        string name
        string designation
        boolean isKeyPersonnel
        objectId accountId
    }
    
    PROPERTY {
        string name
        string code
        string city
    }