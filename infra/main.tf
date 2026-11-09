# ============================================================================
# Lumina Studio — Google Cloud Infrastructure as Code (Terraform)
# Provisions:
# 1. Google Artifact Registry (Docker Repository)
# 2. Google Cloud Storage Bucket (Uploads, TTS WAVs, Omni Flash MP4s)
# 3. Google Cloud Firestore Database (Native / Enterprise Mode for Study Kits)
# 4. Google Cloud Secret Manager Secret (GEMINI_API_KEY)
# 5. Dedicated Least-Privilege Service Account & IAM Bindings
# 6. Google Cloud Run v2 Service (with WebSocket Session Affinity & 1hr Timeout)
# ============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.30.0"
    }
  }
}

variable "project_id" {
  description = "Google Cloud Project ID (Modernality)"
  type        = string
  default     = "personal-portfolio-470022"
}

variable "region" {
  description = "Google Cloud Region for Cloud Run, GCS, and Firestore (NorthEastern US / Northern Virginia)"
  type        = string
  default     = "us-east4"
}

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
  default     = "lumina-tutor"
}

variable "container_image" {
  description = "Full Artifact Registry container image URI"
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# 1. Google Cloud Storage Bucket for Uploaded Sources, TTS WAVs, and Omni Flash MP4s
resource "google_storage_bucket" "lumina_media" {
  name                        = "${var.project_id}-lumina-media"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "PUT", "POST", "OPTIONS"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

# 2. Cloud Firestore Database for Study Kits & Progress Persistence
resource "google_firestore_database" "lumina_db" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"
}

# 3. Artifact Registry Docker Repository
resource "google_artifact_registry_repository" "lumina_repo" {
  location      = var.region
  repository_id = "lumina-repo"
  description   = "Container repository for Lumina Studio AI Tutor"
  format        = "DOCKER"
}

# 4. Secret Manager Secret for GEMINI_API_KEY
resource "google_secret_manager_secret" "gemini_api_key" {
  secret_id = "GEMINI_API_KEY"
  replication {
    auto {}
  }
}

# 5. Dedicated Cloud Run Service Account + Least-Privilege IAM Roles
resource "google_service_account" "lumina_runner" {
  account_id   = "lumina-tutor-sa"
  display_name = "Lumina Studio Cloud Run Service Account"
}

resource "google_project_iam_member" "firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.lumina_runner.email}"
}

resource "google_storage_bucket_iam_member" "gcs_object_admin" {
  bucket = google_storage_bucket.lumina_media.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.lumina_runner.email}"
}

resource "google_secret_manager_secret_iam_member" "secret_accessor" {
  secret_id = google_secret_manager_secret.gemini_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.lumina_runner.email}"
}

# 6. Cloud Run v2 Service
resource "google_cloud_run_v2_service" "lumina_service" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account  = google_service_account.lumina_runner.email
    timeout          = "3600s"
    session_affinity = true

    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }

    containers {
      image = var.container_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi"
        }
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name  = "GCS_BUCKET_NAME"
        value = google_storage_bucket.lumina_media.name
      }
      env {
        name  = "FIRESTORE_DATABASE"
        value = google_firestore_database.lumina_db.name
      }
      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gemini_api_key.secret_id
            version = "latest"
          }
        }
      }
    }
  }
}

output "cloud_run_url" {
  description = "Deployed Lumina Studio Cloud Run URL"
  value       = google_cloud_run_v2_service.lumina_service.uri
}

output "gcs_bucket_name" {
  description = "Provisioned Google Cloud Storage Bucket"
  value       = google_storage_bucket.lumina_media.name
}
