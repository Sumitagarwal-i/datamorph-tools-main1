# Deploy all Supabase Edge Functions
# Run this script after setting up Supabase CLI

Write-Host "🚀 Deploying Supabase Edge Functions..." -ForegroundColor Green

# Navigate to project root
$projectRoot = "c:\Users\sumit\Downloads\datamorph-tools-main1-main\datamorph-tools-main1-main"
Set-Location $projectRoot

Write-Host "`n📦 Deploying 'analyze' function..." -ForegroundColor Cyan
supabase functions deploy analyze --no-verify-jwt --project-ref emvtxsjzxcpluflrdyut

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 'analyze' deployed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ 'analyze' deployment failed" -ForegroundColor Red
}

Write-Host "`n📦 Deploying 'cache-management' function..." -ForegroundColor Cyan
supabase functions deploy cache-management --no-verify-jwt --project-ref emvtxsjzxcpluflrdyut

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 'cache-management' deployed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ 'cache-management' deployment failed" -ForegroundColor Red
}

Write-Host "`n📦 Deploying 'system' function..." -ForegroundColor Cyan
supabase functions deploy system --no-verify-jwt --project-ref emvtxsjzxcpluflrdyut

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 'system' deployed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ 'system' deployment failed" -ForegroundColor Red
}

Write-Host "`n✨ Deployment complete!" -ForegroundColor Green
Write-Host "`n🔑 Don't forget to set your GROQ_API_KEY:" -ForegroundColor Yellow
Write-Host "supabase secrets set GROQ_API_KEY=your_key_here --project-ref emvtxsjzxcpluflrdyut" -ForegroundColor Gray

Write-Host "`n📊 View functions at:" -ForegroundColor Cyan
Write-Host "https://supabase.com/dashboard/project/emvtxsjzxcpluflrdyut/functions" -ForegroundColor Blue

Write-Host "`n🧪 Test endpoints:" -ForegroundColor Cyan
Write-Host "• Analyze: https://emvtxsjzxcpluflrdyut.supabase.co/functions/v1/analyze" -ForegroundColor Gray
Write-Host "• Cache: https://emvtxsjzxcpluflrdyut.supabase.co/functions/v1/cache-management?action=stats" -ForegroundColor Gray
Write-Host "• System: https://emvtxsjzxcpluflrdyut.supabase.co/functions/v1/system?action=health" -ForegroundColor Gray
