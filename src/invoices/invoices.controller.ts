import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantInterceptor } from '../common/interceptors/tenant.interceptor';

@ApiTags('Invoices')
@ApiBearerAuth('JWT')
@ApiSecurity('x-tenant-id')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantInterceptor)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an invoice in the current tenant' })
  @ApiResponse({ status: 201, description: 'Invoice created', type: Invoice })
  @ApiResponse({ status: 409, description: 'Invoice number already exists' })
  create(@Body() dto: CreateInvoiceDto): Promise<Invoice> {
    return this.invoicesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all invoices in the current tenant' })
  @ApiResponse({ status: 200, description: 'Invoice list', type: [Invoice] })
  findAll(): Promise<Invoice[]> {
    return this.invoicesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an invoice by ID' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({ status: 200, description: 'Invoice found', type: Invoice })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Invoice> {
    return this.invoicesService.findById(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update invoice status' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: Object.values(InvoiceStatus) },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Status updated', type: Invoice })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: InvoiceStatus,
  ): Promise<Invoice> {
    return this.invoicesService.updateStatus(id, status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an invoice' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({ status: 204, description: 'Invoice deleted' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.invoicesService.remove(id);
  }
}
