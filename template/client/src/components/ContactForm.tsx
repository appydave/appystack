import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type FormData = z.infer<typeof schema>;

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
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium mb-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          Name
        </label>
        <input
          id="name"
          type="text"
          placeholder="Your name"
          {...register('name')}
          className="w-full px-3 py-2 rounded text-sm"
          style={{
            backgroundColor: 'var(--dark-bg)',
            border: errors.name ? '1px solid #f87171' : '1px solid var(--card-border)',
            color: 'var(--text-primary)',
          }}
        />
        {errors.name && (
          <span role="alert" className="text-red-400 text-xs mt-1 block">
            {errors.name.message}
          </span>
        )}
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium mb-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          {...register('email')}
          className="w-full px-3 py-2 rounded text-sm"
          style={{
            backgroundColor: 'var(--dark-bg)',
            border: errors.email ? '1px solid #f87171' : '1px solid var(--card-border)',
            color: 'var(--text-primary)',
          }}
        />
        {errors.email && (
          <span role="alert" className="text-red-400 text-xs mt-1 block">
            {errors.email.message}
          </span>
        )}
      </div>

      <div>
        <label
          htmlFor="message"
          className="block text-sm font-medium mb-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          Message
        </label>
        <textarea
          id="message"
          rows={4}
          placeholder="Your message..."
          {...register('message')}
          className="w-full px-3 py-2 rounded text-sm resize-none"
          style={{
            backgroundColor: 'var(--dark-bg)',
            border: errors.message ? '1px solid #f87171' : '1px solid var(--card-border)',
            color: 'var(--text-primary)',
          }}
        />
        {errors.message && (
          <span role="alert" className="text-red-400 text-xs mt-1 block">
            {errors.message.message}
          </span>
        )}
      </div>

      <button
        type="submit"
        className="px-4 py-2 rounded text-sm font-medium transition-colors"
        style={{
          backgroundColor: 'var(--terminal-green)',
          color: 'var(--dark-bg)',
        }}
      >
        Send
      </button>
    </form>
  );
}
