document.addEventListener('DOMContentLoaded', function() {
    let currentVideoData = null;

    // Helper functions
    function showError(message) {
        const errorContainer = document.getElementById('error-container');
        const errorMessage = document.getElementById('error-message');
        if (errorContainer && errorMessage) {
            errorMessage.textContent = message;
            errorContainer.classList.remove('d-none');
        }
    }

    // Initialize elements
    const youtubeForm = document.getElementById('youtube-form');
    const youtubeUrl = document.getElementById('youtube-url');
    const videoInfo = document.getElementById('video-info');
    const downloadButton = document.getElementById('download-button');
    const driveFolderSelection = document.getElementById('drive-folder-selection');
    const driveFolders = document.getElementById('drive-folders');
    const startProcessButton = document.getElementById('start-process-button');
    const progressContainer = document.getElementById('progress-container');
    const downloadProgress = document.getElementById('download-progress');
    const uploadProgress = document.getElementById('upload-progress');
    const downloadStatus = document.getElementById('download-status');
    const uploadStatus = document.getElementById('upload-status');
    const resultContainer = document.getElementById('result-container');
    const viewInDrive = document.getElementById('view-in-drive');
    const videoTitle = document.getElementById('video-title');
    const videoThumbnail = document.getElementById('video-thumbnail');
    const videoUploader = document.getElementById('video-uploader');
    const videoDuration = document.getElementById('video-duration');


    // YouTube form submission
    if (youtubeForm) {
        youtubeForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const url = youtubeUrl.value.trim();

            if (!url) {
                showError('Please enter a YouTube URL');
                return;
            }

            // Fetch video info
            fetch('/get_video_info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) throw new Error(data.error);

                videoInfo.classList.remove('d-none');
                document.getElementById('video-title').textContent = data.title;
                document.getElementById('video-duration').textContent = formatDuration(data.duration);
                document.getElementById('video-uploader').textContent = data.uploader;
                document.getElementById('video-thumbnail').src = data.thumbnail;
                downloadButton.disabled = false;
            })
            .catch(error => {
                showError('Error fetching video info: ' + error.message);
            });
        });
    }

    // Download button click handler
    // Save to Device button handler
    const saveToDeviceBtn = document.getElementById('save-to-device');
    if (saveToDeviceBtn) {
        saveToDeviceBtn.addEventListener('click', async function() {
            if (!currentVideoData || !currentVideoData.filename) {
                showError('Please download a video first');
                return;
            }

            saveToDeviceBtn.disabled = true;
            saveToDeviceBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Preparing Download...';

            try {
                const response = await fetch(`/download_file/${encodeURIComponent(currentVideoData.filename)}`);
                if (!response.ok) throw new Error('Download failed');
                
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = currentVideoData.title + '.mp4';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                saveToDeviceBtn.innerHTML = '<i class="fas fa-check me-2"></i>Downloaded';
            } catch (error) {
                showError('Error downloading file: ' + error.message);
                saveToDeviceBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save to Device';
            }
            saveToDeviceBtn.disabled = false;
        });
    }

    if (downloadButton) {
        downloadButton.addEventListener('click', function() {
            downloadButton.disabled = true;
            downloadButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Downloading...';

            fetch('/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: youtubeUrl.value.trim() })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) throw new Error(data.error);

                console.log('Download successful, storing data:', data);
                currentVideoData = data;
                console.log('Current video data:', JSON.stringify(currentVideoData));

                if (driveFolderSelection) {
                    driveFolderSelection.classList.remove('d-none');
                }
                downloadButton.innerHTML = '<i class="fas fa-check me-2"></i>Download Complete';

                // Fetch drive folders
                return fetch('/get_drive_folders');
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) throw new Error(data.error);

                if (data.folders && data.folders.length > 0 && driveFolders) {
                    driveFolders.innerHTML = `
                        <option value="">Select a folder...</option>
                        ${data.folders.map(folder => 
                            `<option value="${folder.id}">${folder.name}</option>`
                        ).join('')}
                    `;
                }
            })
            .catch(error => {
                downloadButton.disabled = false;
                downloadButton.innerHTML = '<i class="fas fa-download me-2"></i>Download Video';
                showError('Error: ' + error.message);
            });
        });
    }

    // Start process button click handler
    if (startProcessButton) {
        startProcessButton.addEventListener('click', function() {
            if (!driveFolders || !driveFolders.value) {
                showError('Please select a Google Drive folder');
                return;
            }

            progressContainer.classList.remove('d-none');
            startProcessButton.disabled = true;

            // Reset progress bars
            downloadProgress.style.width = '0%';
            downloadProgress.textContent = '0%';
            uploadProgress.style.width = '0%';
            uploadProgress.textContent = '0%';

            // Upload to Drive
            fetch('/upload_to_drive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: currentVideoData.filename,
                    folder_id: driveFolders.value,
                    video_id: currentVideoData.video_id
                }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) throw new Error(data.error);

                uploadProgress.style.width = '100%';
                uploadProgress.textContent = '100%';
                uploadStatus.textContent = 'Upload Complete!';

                resultContainer.classList.remove('d-none');
                if (data.file_id) {
                    viewInDrive.href = `https://drive.google.com/file/d/${data.file_id}/view`;
                }
            })
            .catch(error => {
                showError('Upload error: ' + error.message);
                startProcessButton.disabled = false;
            });
        });
    }

    // Initialize Drive folders if authenticated
    if (window.authSuccess) {
        fetch('/get_drive_folders')
            .then(response => response.json())
            .then(data => {
                if (data.error) throw new Error(data.error);

                if (data.folders && data.folders.length > 0 && driveFolders) {
                    driveFolders.innerHTML = `
                        <option value="">Select a folder...</option>
                        ${data.folders.map(folder => 
                            `<option value="${folder.id}">${folder.name}</option>`
                        ).join('')}
                    `;
                }
            })
            .catch(error => {
                showError('Error loading folders: ' + error.message);
            });
    }

    function formatDuration(seconds) {
        if (!seconds) return 'Unknown';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }


    // YouTube upload elements
    const uploadToYouTubeButton = document.getElementById('upload-to-youtube-button');
    const youtubeUploadForm = document.getElementById('youtube-upload-form');
    const youtubeTitleInput = document.getElementById('youtube-title');
    const youtubeDescriptionInput = document.getElementById('youtube-description');
    const youtubeTagsInput = document.getElementById('youtube-tags');
    const youtubePrivacySelect = document.getElementById('youtube-privacy');
    const startYoutubeUploadButton = document.getElementById('start-youtube-upload');
    const youtubeProgress = document.getElementById('youtube-progress');
    const youtubeUploadProgress = document.getElementById('youtube-upload-progress');
    const youtubeUploadStatus = document.getElementById('youtube-upload-status');
    const youtubeResult = document.getElementById('youtube-result');
    const viewOnYoutube = document.getElementById('view-on-youtube');


    // YouTube upload button click handler
    let youtubeProgressInterval;
    if (startYoutubeUploadButton) {
        startYoutubeUploadButton.addEventListener('click', function() {
            // Get form values
            const title = youtubeTitleInput.value || 'Uploaded video';
            const description = youtubeDescriptionInput.value || '';
            const tags = youtubeTagsInput.value || '';
            const privacyStatus = youtubePrivacySelect.value || 'private';

            if (!currentVideoData.filename) {
                showError('No video file available for upload');
                return;
            }

            // Hide form and show progress
            youtubeUploadForm.classList.add('d-none');
            youtubeProgress.classList.remove('d-none');
            youtubeUploadStatus.textContent = 'Preparing YouTube upload...';

            // Simulate YouTube upload progress
            simulateYoutubeUploadProgress();

            // Start YouTube upload
            fetch('/upload_to_youtube', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    filename: currentVideoData.filename,
                    video_id: currentVideoData.video_id,
                    title: title,
                    description: description,
                    tags: tags,
                    privacy_status: privacyStatus
                }),
            })
            .then(response => response.json())
            .then(data => {
                // Clear interval
                clearInterval(youtubeProgressInterval);

                if (data.error) {
                    showError(data.error);
                    youtubeProgress.classList.add('d-none');

                    // Special handling for authentication errors
                    if (data.action_required === 'reauth') {
                        console.log("Authentication issue detected, need to reauth");

                        // Show reauthentication button 
                        if (confirm("YouTube API permissions missing. Would you like to log out and log back in to grant needed permissions?")) {
                            window.location.href = '/logout';
                        }
                    }
                    return;
                }

                // Update progress to 100%
                youtubeUploadProgress.style.width = '100%';
                youtubeUploadProgress.textContent = '100%';
                youtubeUploadStatus.textContent = 'Upload to YouTube complete!';

                // Show success message
                const successAlert = document.createElement('div');
                successAlert.className = 'alert alert-success mt-3';
                successAlert.innerHTML = `
                    <h5>Upload Complete!</h5>
                    <p>Your video has been successfully uploaded to YouTube.</p>
                    <a href="https://www.youtube.com/watch?v=${data.youtube_video_id}" target="_blank" class="btn btn-outline-success btn-sm">
                        <i class="fab fa-youtube me-2"></i>View on YouTube
                    </a>
                `;
                
                // Insert after progress container
                const progressContainer = document.getElementById('progress-container');
                progressContainer.insertAdjacentElement('afterend', successAlert);

                // Hide progress bars after 2 seconds
                setTimeout(() => {
                    document.getElementById('youtube-progress').classList.add('d-none');
                }, 2000);
            })
            .catch(error => {
                clearInterval(youtubeProgressInterval);
                showError('YouTube upload error: ' + error.message);
                youtubeProgress.classList.add('d-none');
            });
        });
    }

    // Simulate YouTube upload progress
    function simulateYoutubeUploadProgress() {
        let progress = 0;

        youtubeProgressInterval = setInterval(() => {
            if (progress < 95) { // Only go to 95% for simulation
                progress += Math.random() * 5;
                progress = Math.min(progress, 95);

                youtubeUploadProgress.style.width = `${progress}%`;
                youtubeUploadProgress.textContent = `${Math.round(progress)}%`;

                if (progress < 30) {
                    youtubeUploadStatus.textContent = 'Preparing video for YouTube...';
                } else if (progress < 60) {
                    youtubeUploadStatus.textContent = 'Uploading to YouTube...';
                } else if (progress < 90) {
                    youtubeUploadStatus.textContent = 'Processing on YouTube servers...';
                }
            } else {
                clearInterval(youtubeProgressInterval);
            }
        }, 1000);
    }

    //Simulate download and upload progress
    let downloadProgressTimeout;
    let uploadProgressTimeout;

    function simulateDownloadProgress() {
        let progress = 0;

        downloadProgressTimeout = setInterval(() => {
            if (progress < 100) {
                progress += Math.random() * 10;
                progress = Math.min(progress, 100);

                downloadProgress.style.width = `${progress}%`;
                downloadProgress.textContent = `${Math.round(progress)}%`;

                if (progress < 30) {
                    downloadStatus.textContent = 'Initializing download...';
                } else if (progress < 60) {
                    downloadStatus.textContent = 'Downloading video...';
                } else if (progress < 90) {
                    downloadStatus.textContent = 'Processing video...';
                } else {
                    downloadStatus.textContent = 'Download complete!';
                    clearInterval(downloadProgressTimeout);

                    // Show YouTube upload button
                    const uploadToYouTubeButton = document.getElementById('upload-to-youtube-button');
                    if (uploadToYouTubeButton) {
                        uploadToYouTubeButton.classList.remove('d-none');
                    }
                }
            } else {
                clearInterval(downloadProgressTimeout);
            }
        }, 1000);
    }

    function simulateUploadProgress() {
        let progress = 0;

        uploadProgressTimeout = setInterval(() => {
            if (progress < 100) {
                progress += Math.random() * 8;
                progress = Math.min(progress, 100);

                uploadProgress.style.width = `${progress}%`;
                uploadProgress.textContent = `${Math.round(progress)}%`;

                if (progress < 30) {
                    uploadStatus.textContent = 'Preparing for upload...';
                } else if (progress < 60) {
                    uploadStatus.textContent = 'Uploading to Google Drive...';
                } else if (progress < 90) {
                    uploadStatus.textContent = 'Finalizing upload...';
                } else {
                    uploadStatus.textContent = 'Upload complete!';
                    clearInterval(uploadProgressTimeout);

                    // Show result after upload is complete
                    setTimeout(() => {
                        progressContainer.classList.add('d-none');
                        resultContainer.classList.remove('d-none');
                    }, 1000);
                }
            } else {
                clearInterval(uploadProgressTimeout);
            }
        }, 1500);
    }

    // Start simulated progress when process starts
    if (startProcessButton) {
        startProcessButton.addEventListener('click', function() {
            // Clear any existing intervals
            clearInterval(downloadProgressTimeout);
            clearInterval(uploadProgressTimeout);

            // Reset progress bars
            downloadProgress.style.width = '0%';
            downloadProgress.textContent = '0%';
            uploadProgress.style.width = '0%';
            uploadProgress.textContent = '0%';

            // Start simulated progress
            simulateDownloadProgress();

            // Start upload progress after a delay
            setTimeout(() => {
                simulateUploadProgress();
            }, 5000);
        });
    }



    // Authenticate with Google Drive
    const authButton = document.getElementById('auth-button');
    if (authButton) {
        authButton.addEventListener('click', function() {
            window.location.href = '/auth';
        });
    }

    // YouTube upload button click handler
    if (uploadToYouTubeButton) {
        uploadToYouTubeButton.addEventListener('click', function() {
            // Log current video data state before showing upload form
            console.log("YouTube upload button clicked, current data:", JSON.stringify(currentVideoData));

            // Check if video was downloaded but data might not be in currentVideoData
            if (!currentVideoData.filename && videoTitle.textContent) {
                // This suggests the UI shows a video but currentVideoData might be empty
                // Try to find video data from the UI
                console.log("Attempting to restore missing video data");

                // If we have direct access to video_id (e.g., from server-side)
                // Then we could do something like fetch('/get_video_path/' + video_id)
                // For now, we'll show an informative error
                if (!currentVideoData.filename) {
                    showError('Please download the video first before uploading to YouTube');
                    return;
                }
            }

            youtubeUploadForm.classList.toggle('d-none');

            // Pre-fill title field with the video title
            if (videoTitle.textContent) {
                youtubeTitleInput.value = videoTitle.textContent;
            }

            // Pre-fill description with basic info
            youtubeDescriptionInput.value = `Uploaded via YouTube Downloader App\nOriginal video: ${youtubeUrl.value}`;
        });
    }

});