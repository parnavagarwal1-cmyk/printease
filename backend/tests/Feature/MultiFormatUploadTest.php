<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Order;
use App\Models\Printer;
use App\Models\QrCode;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MultiFormatUploadTest extends TestCase
{
    use RefreshDatabase;

    protected Branch $branch;
    protected QrCode $qrCode;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $user = User::factory()->create();
        $shop = Shop::create([
            'name' => 'Metro Multi-Format Print',
            'slug' => 'metro-multi-format',
            'owner_id' => $user->id,
            'contact_email' => 'metro@prints.com',
            'currency' => 'INR',
        ]);

        $this->branch = Branch::create([
            'shop_id' => $shop->id,
            'name' => 'Main Branch',
            'code' => 'BR-01',
            'merchant_vpa' => 'metro@upi',
            'is_active' => true,
        ]);

        $this->qrCode = QrCode::create([
            'branch_id' => $this->branch->id,
            'token' => 'pe_test_format_token_99',
            'label' => 'Counter QR',
            'is_active' => true,
        ]);
    }

    public function test_uploads_jpg_image_as_single_page(): void
    {
        $file = UploadedFile::fake()->image('passport_photo.jpg', 600, 600);

        $response = $this->postJson("/api/public/qr/{$this->qrCode->token}/upload", [
            'file' => $file,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('file.original_name', 'passport_photo.jpg')
            ->assertJsonPath('file.page_count', 1);
    }

    public function test_uploads_png_image_as_single_page(): void
    {
        $file = UploadedFile::fake()->image('signature_scan.png', 800, 400);

        $response = $this->postJson("/api/public/qr/{$this->qrCode->token}/upload", [
            'file' => $file,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('file.original_name', 'signature_scan.png')
            ->assertJsonPath('file.page_count', 1);
    }

    public function test_uploads_docx_word_document(): void
    {
        // Fake docx with XML containing <Pages>3</Pages>
        $docxContent = 'PK\x03\x04' . '<Pages>3</Pages>';
        $file = UploadedFile::fake()->createWithContent('project_report.docx', $docxContent);

        $response = $this->postJson("/api/public/qr/{$this->qrCode->token}/upload", [
            'file' => $file,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('file.original_name', 'project_report.docx')
            ->assertJsonPath('file.page_count', 3);
    }

    public function test_uploads_standard_pdf(): void
    {
        $pdfContent = "%PDF-1.4\n/Type /Pages /Count 5\n";
        $file = UploadedFile::fake()->createWithContent('resume.pdf', $pdfContent);

        $response = $this->postJson("/api/public/qr/{$this->qrCode->token}/upload", [
            'file' => $file,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('file.original_name', 'resume.pdf')
            ->assertJsonPath('file.page_count', 5);
    }

    public function test_rejects_unsupported_file_formats(): void
    {
        $file = UploadedFile::fake()->create('malicious_script.exe', 100);

        $response = $this->postJson("/api/public/qr/{$this->qrCode->token}/upload", [
            'file' => $file,
        ]);

        $response->assertStatus(422);
    }
}
