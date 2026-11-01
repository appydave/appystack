import { useForm } from 'react-hook-form';
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils.js';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type FormData = z.infer<typeof schema>;

interface FormFieldProps {
  id: string;
  label: string;
  error: FieldError | undefined;
  registration: UseFormRegisterReturn;
  control: 'input' | 'textarea';
  type?: string;
  placeholder: string;
}

const INPUT_CLASSES = 'w-full px-3 py-2 rounded text-sm bg-background text-foreground border';
const TEXTAREA_CLASSES =
  'w-full px-3 py-2 rounded text-sm resize-none bg-background text-foreground border';

function FormField({
  id,
  label,
  error,
  registration,
  control,
  type = 'text',
  placeholder,
}: FormFieldProps) {
  const className = cn(
    control === 'textarea' ? TEXTAREA_CLASSES : INPUT_CLASSES,
    error ? 'border-destructive' : 'border-border'
  );

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1 text-muted-foreground">
        {label}
      </label>
      {control === 'textarea' ? (
        <textarea
          id={id}
          rows={4}
          placeholder={placeholder}
          {...registration}
          className={className}
        />
      ) : (
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          {...registration}
          className={className}
        />
      )}
      {error && (
        <span role="alert" className="text-red-400 text-xs mt-1 block">
          {error.message}
        </span>
      )}
    </div>
  );
}

export default function ContactForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormData) => {
    console.log(data); // TODO: wire to your API
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 max-w-md">
      <FormField
        id="name"
        label="Name"
        control="input"
        placeholder="Your name"
        error={errors.name}
        registration={register('name')}
      />

      <FormField
        id="email"
        label="Email"
        control="input"
        type="email"
        placeholder="you@example.com"
        error={errors.email}
        registration={register('email')}
      />

      <FormField
        id="message"
        label="Message"
        control="textarea"
        placeholder="Your message..."
        error={errors.message}
        registration={register('message')}
      />

      <button
        type="submit"
        className="px-4 py-2 rounded text-sm font-medium transition-colors bg-primary text-primary-foreground"
      >
        Send
      </button>
    </form>
  );
}
